"""
Parsing helpers shared by CSV import and JSON quote feeds.

Numbers
  'vi'  1.234.567,89   (dot = thousands, comma = decimal)
  'en'  1,234,567.89   (comma = thousands, dot = decimal)
Dates are read as day-first (Vietnamese convention) when ambiguous.
"""
import math
import re
import unicodedata
from datetime import datetime, timezone
from typing import Iterable, Optional

VN_DATETIME_FMT = "%d/%m/%Y %H:%M:%S"


def normalize_text(value) -> str:
    """Lower-case, strip Vietnamese diacritics and punctuation: 'Thành tiền (VNĐ)' → 'thanh tien vnd'."""
    s = unicodedata.normalize("NFD", str(value or ""))
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = s.replace("đ", "d").replace("Đ", "D").lower()
    s = re.sub(r"[^a-z0-9%]+", " ", s)
    return s.strip()


_CURRENCY = re.compile(r"(vnđ|vnd|usdt|usdc|usd|₫|\$|€|đ)", re.IGNORECASE)


def _clean_numeric(value: str):
    s = str(value).strip().replace(" ", "").replace(" ", "")
    s = _CURRENCY.sub("", s)
    negative = False
    if s.startswith("(") and s.endswith(")"):
        negative, s = True, s[1:-1]
    if s[:1] in ("-", "−"):
        negative, s = True, s[1:]
    elif s[:1] == "+":
        s = s[1:]
    s = s.rstrip("%")
    return s, negative


def guess_number_format(s: str) -> Optional[str]:
    """Format implied by a single numeric string, or None when ambiguous."""
    has_dot, has_comma = "." in s, "," in s
    if has_dot and has_comma:
        return "vi" if s.rfind(",") > s.rfind(".") else "en"
    if has_comma:
        return "en" if re.fullmatch(r"\d{1,3}(,\d{3})+", s) else "vi"
    if has_dot:
        if re.fullmatch(r"\d{1,3}(\.\d{3}){2,}", s):
            return "vi"
        if re.fullmatch(r"\d{1,3}\.\d{3}", s):
            return None  # 1.234 → thousands (vi) or decimal (en)?
        return "en"
    return None


def detect_number_format(values: Iterable) -> str:
    """Pick 'vi' or 'en' for a whole file by majority of unambiguous cells (default 'en')."""
    votes = {"vi": 0, "en": 0}
    for v in values:
        if v is None or isinstance(v, (int, float)):
            continue
        s, _ = _clean_numeric(v)
        if not s or not re.fullmatch(r"[\d.,]+", s):
            continue
        fmt = guess_number_format(s)
        if fmt:
            votes[fmt] += 1
    return "vi" if votes["vi"] > votes["en"] else "en"


def parse_number(value, fmt: str = "auto") -> Optional[float]:
    """Parse '25.794.645,76', '1,234.5', '(12)', '−3', 42 … → float, or None."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(value) else None
    s, negative = _clean_numeric(value)
    if not s or not re.fullmatch(r"[\d.,]+", s):
        return None
    if fmt not in ("vi", "en"):
        fmt = guess_number_format(s) or "en"
    s = s.replace(".", "").replace(",", ".") if fmt == "vi" else s.replace(",", "")
    try:
        number = float(s)
    except ValueError:
        return None
    return -number if negative else number


_DATE_PATTERNS = [
    (re.compile(r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$"), "dmy"),
    (re.compile(r"^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$"), "ymd"),
]


def parse_date_any(value) -> Optional[datetime]:
    """Parse dd/MM/yyyy[ HH:mm[:ss]], yyyy-MM-dd[THH:mm:ss], or epoch seconds/milliseconds."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) or (isinstance(value, str) and re.fullmatch(r"\d{10,13}", value.strip())):
        number = float(value)
        if number > 1e11:
            number /= 1000.0
        if number > 1e9:
            return datetime.fromtimestamp(number, tz=timezone.utc).replace(tzinfo=None)
        return None
    s = str(value).strip()
    for pattern, order in _DATE_PATTERNS:
        m = pattern.match(s)
        if not m:
            continue
        a, b, c, hh, mm, ss = m.groups()
        try:
            if order == "dmy":
                return datetime(int(c), int(b), int(a), int(hh or 0), int(mm or 0), int(ss or 0))
            return datetime(int(a), int(b), int(c), int(hh or 0), int(mm or 0), int(ss or 0))
        except ValueError:
            return None
    return None


def to_vn_datetime(dt: datetime) -> str:
    return dt.strftime(VN_DATETIME_FMT)


def to_iso_date(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")

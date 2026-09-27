"""
User-configurable JSON quote feed — the equivalent of Portfolio Performance's
"GENERIC-JSON" quote feed: a URL plus JSONPath expressions for the close price
(and optionally the date), with an optional factor for unit conversion.

Because the backend fetches URLs chosen by users, every request is guarded:
  - http/https only, default ports only, no credentials in the URL
  - the host must resolve to public IP addresses (no localhost, private,
    link-local, metadata or reserved ranges)
  - redirects are not followed, responses are capped at 1 MB, 10 s timeout
"""
import ipaddress
import json
import logging
import re
import socket
from datetime import date
from typing import Optional
from urllib.parse import urlparse

import requests

from app.utils.parsing import parse_date_any, parse_number, to_iso_date

logger = logging.getLogger("quote_feed")

MAX_BYTES = 1_000_000
TIMEOUT_SECONDS = 10
USER_AGENT = "PortfolioManager/1.0 (+quote feed)"


class FeedError(Exception):
    """A user-facing error while configuring or reading a quote feed."""


# ── URL safety ──

def _assert_public_address(host: str) -> None:
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise FeedError("Không phân giải được tên miền")
    if not infos:
        raise FeedError("Không phân giải được tên miền")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if ip.version == 6 and ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        if not ip.is_global or ip.is_multicast:
            raise FeedError("Địa chỉ nội bộ hoặc không công khai không được phép")


def validate_feed_url(url: str) -> str:
    url = (url or "").strip()
    if not url or len(url) > 2000:
        raise FeedError("URL không hợp lệ")
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise FeedError("Chỉ hỗ trợ URL http hoặc https")
    if not parsed.hostname:
        raise FeedError("URL thiếu tên miền")
    if parsed.username or parsed.password:
        raise FeedError("URL không được chứa thông tin đăng nhập")
    try:
        port = parsed.port
    except ValueError:
        raise FeedError("Cổng không hợp lệ")
    if port not in (None, 80, 443):
        raise FeedError("Chỉ hỗ trợ cổng mặc định 80/443")
    _assert_public_address(parsed.hostname)
    return url


def _strip_js_callback(text: str) -> str:
    """Accept JSONP responses such as callback({...});"""
    m = re.match(r"^\s*[\w$.]+\s*\(\s*(.*?)\s*\)\s*;?\s*$", text, re.S)
    return m.group(1) if m else text


def fetch_json(url: str):
    url = validate_feed_url(url)
    try:
        with requests.get(url, timeout=TIMEOUT_SECONDS, allow_redirects=False, stream=True,
                          headers={"Accept": "application/json", "User-Agent": USER_AGENT}) as resp:
            if 300 <= resp.status_code < 400:
                raise FeedError(f"Máy chủ chuyển hướng (HTTP {resp.status_code}); hãy dùng URL đích cuối cùng")
            if resp.status_code != 200:
                raise FeedError(f"Máy chủ trả về HTTP {resp.status_code}")
            body = bytearray()
            for chunk in resp.iter_content(65536):
                body.extend(chunk)
                if len(body) > MAX_BYTES:
                    raise FeedError("Phản hồi quá lớn (tối đa 1 MB)")
            encoding = resp.encoding or "utf-8"
    except FeedError:
        raise
    except requests.RequestException as e:
        raise FeedError(f"Lỗi kết nối: {e.__class__.__name__}")
    text = _strip_js_callback(bytes(body).decode(encoding, errors="replace"))
    try:
        return json.loads(text)
    except ValueError:
        raise FeedError("Phản hồi không phải JSON hợp lệ")


# ── JSONPath (subset) ──
# Supported: $  .key  ['key']  [n]  [*]  .*  ..key  [?(@.field == 'value')]
# Filter operators: == != > >= < <= ; values: 'text', "text", numbers, true/false/null

def _closing_bracket(path: str, start: int) -> int:
    quote = None
    for j in range(start + 1, len(path)):
        ch = path[j]
        if quote:
            if ch == quote:
                quote = None
        elif ch in ("'", '"'):
            quote = ch
        elif ch == "]":
            return j
    raise FeedError("JSONPath thiếu dấu ]")


_FILTER = re.compile(r"^\?\s*\(\s*@\.?([\w$.\-]+)\s*(==|!=|>=|<=|>|<)\s*(.+?)\s*\)$")


def _parse_filter(inner: str):
    m = _FILTER.match(inner)
    if not m:
        raise FeedError(f"Không hỗ trợ bộ lọc [{inner}]")
    key, op, raw = m.groups()
    if raw[:1] in ("'", '"') and raw[-1:] == raw[:1]:
        value = raw[1:-1]
    elif raw in ("true", "false"):
        value = raw == "true"
    elif raw == "null":
        value = None
    else:
        try:
            value = float(raw)
        except ValueError:
            raise FeedError(f"Giá trị so sánh không hợp lệ: {raw}")
    return key.split("."), op, value


def _tokenize(path: str) -> list:
    path = (path or "").strip()
    if not path.startswith("$"):
        raise FeedError("JSONPath phải bắt đầu bằng $")
    tokens, i, n = [], 1, len(path)
    while i < n:
        if path.startswith("..", i):
            i += 2
            m = re.match(r"\*|[^.\[\]\s]+", path[i:])
            if not m:
                raise FeedError("JSONPath sai sau ..")
            tokens.append(("recursive", m.group(0)))
            i += len(m.group(0))
        elif path[i] == ".":
            i += 1
            m = re.match(r"\*|[^.\[\]\s]+", path[i:])
            if not m:
                raise FeedError("JSONPath sai sau dấu .")
            tok = m.group(0)
            tokens.append(("wild", None) if tok == "*" else ("key", tok))
            i += len(tok)
        elif path[i] == "[":
            j = _closing_bracket(path, i)
            inner = path[i + 1:j].strip()
            i = j + 1
            if inner == "*":
                tokens.append(("wild", None))
            elif re.fullmatch(r"-?\d+", inner):
                tokens.append(("index", int(inner)))
            elif len(inner) >= 2 and inner[0] in ("'", '"') and inner[-1] == inner[0]:
                tokens.append(("key", inner[1:-1]))
            elif inner.startswith("?"):
                tokens.append(("filter", _parse_filter(inner)))
            else:
                raise FeedError(f"Không hỗ trợ biểu thức [{inner}]")
        else:
            raise FeedError(f"Ký tự không hợp lệ trong JSONPath: {path[i]}")
    return tokens


def _descend(node, name):
    found = []
    if isinstance(node, dict):
        for k, v in node.items():
            if name == "*" or k == name:
                found.append(v)
            found.extend(_descend(v, name))
    elif isinstance(node, list):
        for v in node:
            if name == "*":
                found.append(v)
            found.extend(_descend(v, name))
    return found


def _get_nested(node, keys):
    for k in keys:
        if isinstance(node, dict) and k in node:
            node = node[k]
        else:
            return _MISSING
    return node


_MISSING = object()


def _matches(item, flt) -> bool:
    keys, op, expected = flt
    actual = _get_nested(item, keys)
    if actual is _MISSING:
        return False
    if isinstance(expected, float):
        number = parse_number(actual)
        if number is None:
            return False
        return {"==": number == expected, "!=": number != expected, ">": number > expected,
                ">=": number >= expected, "<": number < expected, "<=": number <= expected}[op]
    if op == "==":
        return actual == expected or (isinstance(expected, str) and str(actual) == expected)
    if op == "!=":
        return not (actual == expected or (isinstance(expected, str) and str(actual) == expected))
    return False


def jsonpath_find(data, path: str) -> list:
    nodes = [data]
    for kind, arg in _tokenize(path):
        nxt = []
        for node in nodes:
            if kind == "key":
                if isinstance(node, dict) and arg in node:
                    nxt.append(node[arg])
            elif kind == "index":
                if isinstance(node, list) and -len(node) <= arg < len(node):
                    nxt.append(node[arg])
            elif kind == "wild":
                if isinstance(node, list):
                    nxt.extend(node)
                elif isinstance(node, dict):
                    nxt.extend(node.values())
            elif kind == "recursive":
                nxt.extend(_descend(node, arg))
            elif kind == "filter":
                items = node if isinstance(node, list) else list(node.values()) if isinstance(node, dict) else []
                nxt.extend(x for x in items if _matches(x, arg))
        nodes = nxt
    return nodes


# ── Quote extraction ──

def extract_quotes(data, close_path: str, date_path: Optional[str] = None,
                   factor: float = 1.0, number_format: str = "auto") -> dict:
    """Return {"YYYY-MM-DD": price} read from a JSON document."""
    closes = jsonpath_find(data, close_path)
    if not closes:
        raise FeedError("Không tìm thấy giá theo JSONPath của giá")
    dates = jsonpath_find(data, date_path) if date_path else []
    today = date.today().isoformat()

    if dates and len(dates) == len(closes):
        pairs = list(zip(dates, closes))
    elif dates:
        pairs = [(dates[0], closes[0])]
    else:
        pairs = [(None, closes[0])]

    factor = float(factor or 1.0)
    quotes = {}
    for raw_date, raw_close in pairs:
        if raw_date is None:
            iso = today
        else:
            dt = parse_date_any(raw_date)
            if dt is None:
                continue
            iso = to_iso_date(dt)
        price = parse_number(raw_close, number_format)
        if price is None or price <= 0:
            continue
        quotes[iso] = round(price * factor, 8)
    if not quotes:
        raise FeedError("Không đọc được giá hợp lệ; kiểm tra JSONPath của giá và ngày")
    return quotes


def feed_settings(security: dict) -> dict:
    props = security.get("feedProperties") or {}
    return {
        "url": security.get("feedURL") or "",
        "closePath": (props.get("closePath") or "").strip(),
        "datePath": (props.get("datePath") or "").strip() or None,
        "factor": props.get("factor") or 1.0,
        "numberFormat": props.get("numberFormat") or "auto",
    }


def read_json_feed(security: dict, cache: Optional[dict] = None) -> dict:
    """Download and extract quotes for one GENERIC-JSON security."""
    cfg = feed_settings(security)
    if not cfg["url"] or not cfg["closePath"]:
        raise FeedError("Chưa cấu hình URL hoặc JSONPath của giá")
    if cache is not None and cfg["url"] in cache:
        data = cache[cfg["url"]]
    else:
        data = fetch_json(cfg["url"])
        if cache is not None:
            cache[cfg["url"]] = data
    return extract_quotes(data, cfg["closePath"], cfg["datePath"], cfg["factor"], cfg["numberFormat"])


def preview_json_feed(security: dict) -> dict:
    """Like read_json_feed, but also returns a short excerpt of the raw response."""
    cfg = feed_settings(security)
    data = fetch_json(cfg["url"])
    excerpt = json.dumps(data, ensure_ascii=False)[:1500]
    quotes = extract_quotes(data, cfg["closePath"], cfg["datePath"], cfg["factor"], cfg["numberFormat"]) if cfg["closePath"] else {}
    return {"quotes": quotes, "excerpt": excerpt}

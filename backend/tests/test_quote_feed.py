import socket

import pytest

from app.services import quote_feed_service as qf
from app.services.quote_feed_service import FeedError, extract_quotes, jsonpath_find, validate_feed_url

DOC = {
    "success": True,
    "date": "2026-09-27",
    "sell": "176.500.000",
    "data": [
        {"type": "SJC", "buy": 174000000, "sell": 176500000},
        {"type": "NHAN9999", "buy": 83000000, "sell": 84500000, "meta": {"unit": "luong"}},
    ],
    "history": {"t": [1788998400, 1789084800], "c": [100.5, 101.25]},
}


def test_jsonpath_subset():
    assert jsonpath_find(DOC, "$.sell") == ["176.500.000"]
    assert jsonpath_find(DOC, "$.data[1].sell") == [84500000]
    assert jsonpath_find(DOC, "$['data'][-1]['type']") == ["NHAN9999"]
    assert jsonpath_find(DOC, "$.data[*].type") == ["SJC", "NHAN9999"]
    assert jsonpath_find(DOC, "$..unit") == ["luong"]
    assert jsonpath_find(DOC, "$.data[?(@.type=='NHAN9999')].sell") == [84500000]
    assert jsonpath_find(DOC, '$.data[?(@.type == "SJC")].buy') == [174000000]
    assert jsonpath_find(DOC, "$.data[?(@.sell > 100000000)].type") == ["SJC"]
    assert jsonpath_find(DOC, "$.data[?(@.meta.unit=='luong')].type") == ["NHAN9999"]
    assert jsonpath_find(DOC, "$.missing.path") == []
    with pytest.raises(FeedError):
        jsonpath_find(DOC, "data.sell")
    with pytest.raises(FeedError):
        jsonpath_find(DOC, "$.data[?(@.type=~/x/)]")


def test_extract_quotes_latest_history_and_factor():
    assert extract_quotes(DOC, "$.sell", "$.date") == {"2026-09-27": 176500000}
    ring = extract_quotes(DOC, "$.data[?(@.type=='NHAN9999')].sell", "$.date", factor=0.1)
    assert ring == {"2026-09-27": 8450000}
    history = extract_quotes(DOC, "$.history.c[*]", "$.history.t[*]")
    assert sorted(history.values()) == [100.5, 101.25]
    with pytest.raises(FeedError):
        extract_quotes(DOC, "$.nothing")


def _resolve_to(ip):
    return lambda host, *a, **k: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 0))]


@pytest.mark.parametrize("url, ip", [
    ("http://localhost/api", "127.0.0.1"),
    ("https://intranet.example/api", "10.1.2.3"),
    ("http://metadata.google.internal/computeMetadata", "169.254.169.254"),
    ("https://cgnat.example/api", "100.64.0.1"),
])
def test_validate_feed_url_blocks_non_public_addresses(monkeypatch, url, ip):
    monkeypatch.setattr(socket, "getaddrinfo", _resolve_to(ip))
    with pytest.raises(FeedError):
        validate_feed_url(url)


@pytest.mark.parametrize("url", [
    "ftp://example.com/file.json",
    "https://example.com:8443/x",
    "https://user:pass@example.com/x",
    "not a url",
    "",
])
def test_validate_feed_url_rejects_unsupported_urls(monkeypatch, url):
    monkeypatch.setattr(socket, "getaddrinfo", _resolve_to("93.184.216.34"))
    with pytest.raises(FeedError):
        validate_feed_url(url)


def test_validate_feed_url_accepts_public_https(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _resolve_to("93.184.216.34"))
    assert validate_feed_url(" https://www.vang.today/api/prices?type=SJL1L10 ") == "https://www.vang.today/api/prices?type=SJL1L10"


class _Response:
    def __init__(self, status=200, body=b"{}", encoding="utf-8"):
        self.status_code, self._body, self.encoding = status, body, encoding

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def iter_content(self, size):
        for i in range(0, len(self._body), size):
            yield self._body[i:i + size]


def test_fetch_json_guards(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _resolve_to("93.184.216.34"))
    calls = {}

    def fake_get(url, **kwargs):
        calls.update(kwargs)
        return responses.pop(0)

    monkeypatch.setattr(qf.requests, "get", fake_get)
    responses = [_Response(body=b'cb({"price": 5});')]
    assert qf.fetch_json("https://example.com/x") == {"price": 5}
    assert calls["allow_redirects"] is False and calls["timeout"] == qf.TIMEOUT_SECONDS

    responses = [_Response(status=302)]
    with pytest.raises(FeedError):
        qf.fetch_json("https://example.com/x")

    responses = [_Response(body=b"x" * (qf.MAX_BYTES + 10))]
    with pytest.raises(FeedError):
        qf.fetch_json("https://example.com/x")

    responses = [_Response(body=b"<html>not json</html>")]
    with pytest.raises(FeedError):
        qf.fetch_json("https://example.com/x")

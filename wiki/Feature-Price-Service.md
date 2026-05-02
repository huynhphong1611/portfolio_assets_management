# 📈 Feature: Price Service — Hệ thống lấy giá đa nguồn

## Tổng quan

Price Service là engine lấy giá tài sản từ **nhiều nguồn khác nhau**, tự động phân loại và chuyển đổi tiền tệ.

## Nguồn dữ liệu

| Loại tài sản | Nguồn | API | Đơn vị giá |
|--------------|-------|-----|-----------|
| **Cổ phiếu VN** | vnstock (KBS) | `Vnstock().stock().quote.history()` | VNĐ |
| **Quỹ mở** | vnstock (FMarket) | `Fund().listing()` / `Fund().details.nav_report()` | VNĐ |
| **Crypto** | CoinGecko | `/simple/price` + `/coins/{id}/history` | USD → VNĐ |
| **Stablecoin** | CoinGecko | `/simple/price?vs_currencies=vnd` | VNĐ |
| **Vàng SJC** | vang.today | `/api/prices?type=SJL1L10` | VNĐ/lượng |

## Luồng xử lý `get_price()`

```
get_price(symbol="BTC", asset_type_hint=None)
  │
  │  # 1. Kiểm tra theo hint hoặc tự nhận diện
  │
  ├── symbol ∈ {USDT, USDC}?
  │     → get_stablecoin_vnd_rate() → CoinGecko VND rate
  │
  ├── symbol == "GOLD"?
  │     → get_gold_sjc_price() → vang.today API
  │
  ├── hint == "fund" HOẶC symbol ∈ FUND_SYMBOLS?
  │     → get_fund_nav()
  │     │  ├── Try listing (cache 60s) → NAV hiện tại
  │     │  └── Fallback → nav_report (historical)
  │
  ├── hint == "crypto" HOẶC symbol ∈ CRYPTO_MAPPING?
  │     → get_crypto_price_coingecko()
  │     │  ├── Today → /simple/price (latest)
  │     │  └── Historical → /coins/{id}/history
  │
  ├── hint == "stock"?
  │     → get_stock_price(source="kbs")
  │
  └── No hint? (Auto-detect)
       ├── Try get_stock_price() first
       │   └── Success? → Return stock result
       └── Fail? → resolve_coingecko_id()
           └── Found? → get_crypto_price_coingecko()
```

## CoinGecko Auto-Detect

Khi gặp ticker không nằm trong danh sách đã biết, hệ thống sẽ:

1. Check `CRYPTO_MAPPING` (hardcoded: BTC, ETH, SOL...)
2. Check `_coingecko_id_cache` (cache từ lần search trước)
3. Call CoinGecko Search API: `GET /api/v3/search?query={SYMBOL}`
4. Tìm exact match theo `symbol` field
5. Cache kết quả và thêm vào `CRYPTO_MAPPING`

**Ví dụ:** Ticker `HYPE` → Search CoinGecko → tìm thấy `hyperliquid` → cache lại.

## Chuyển đổi tiền tệ

Crypto từ CoinGecko trả về giá **USD**. Scheduler tự động chuyển sang **VNĐ**:

```
price_vnd = price_usd × usdt_vnd_rate
```

`usdt_vnd_rate` lấy từ CoinGecko `tether` → VND.

## Rate Limiting & Caching

| Cơ chế | Thông số | Mục đích |
|--------|---------|---------|
| **In-memory cache** | TTL 60s | Fund listing không fetch lại trong 60s |
| **Batch delay** | 0.5s/ticker | Tránh vnstock/CoinGecko rate limit |
| **CoinGecko ID cache** | Permanent (in-process) | Auto-detect chỉ search 1 lần/session |
| **Error handling** | Detect "GIỚI HẠN API" | Log rate limit riêng, không retry |

## Danh sách Crypto đã mapping

```python
CRYPTO_MAPPING = {
    "BTC": "bitcoin",      "ETH": "ethereum",
    "PAXG": "pax-gold",    "BNB": "binancecoin",
    "SOL": "solana",       "XRP": "ripple",
    "ADA": "cardano",      "DOGE": "dogecoin",
    "DOT": "polkadot",     "AVAX": "avalanche-2",
    "LINK": "chainlink",   "UNI": "uniswap",
    "AAVE": "aave",        "ATOM": "cosmos",
    "NEAR": "near",        "ARB": "arbitrum",
    "OP": "optimism",      "SUI": "sui",
    "APT": "aptos",        "INJ": "injective-protocol",
    "FTM": "fantom",       "HYPE": "hyperliquid",
}
```

## Danh sách Fund symbols

```python
FUND_SYMBOLS = {
    "VFF", "VESAF", "DCBF", "DCDS", "DCIP", "DCDE", "DCAF",
    "SSISCA", "BVPF", "VEOF", "VCBFTBF", "VNDCF", "MBVF",
    "TCBF", "VIBF", "VFMVSF", "VFMVF1", "VFMVF4", "HDBOND"
}
```

---

## Xem thêm

- [[Feature Scheduler]] — Lịch trình fetch giá tự động
- [[Feature Snapshot Engine]] — Chụp nhanh danh mục
- [[Architecture Backend]] — Kiến trúc backend

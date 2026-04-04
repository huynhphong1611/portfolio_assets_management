export const mockTransactions = [
  // 1. Nạp tiền
  {
    assetClass: "Tiền mặt VNĐ",
    currency: "VNĐ",
    date: "14/03/2026 10:00:00",
    quantity: 100000000, // 100M VND
    totalVND: 100000000,
    storage: "Techcombank",
    ticker: "VNĐ",
    transactionType: "Nạp tiền"
  },
  // 2. Mua ETF
  {
    assetClass: "Cổ phiếu",
    currency: "VNĐ",
    date: "15/03/2026 10:00:00",
    quantity: 1000,
    totalVND: 25000000, // Giá 25.000 / CCQ
    storage: "TCBS",
    ticker: "FUEVN100",
    transactionType: "Mua"
  },
  // 3. Bán 1 phần ETF
  {
    assetClass: "Cổ phiếu",
    currency: "VNĐ",
    date: "16/03/2026 10:00:00",
    quantity: 200,
    totalVND: 5200000, // Bán với giá 26000
    storage: "TCBS",
    ticker: "FUEVN100",
    transactionType: "Bán"
  },
  // 4. Mua USDT
  {
    assetClass: "Tiền mặt USD",
    currency: "VNĐ",
    date: "17/03/2026 10:00:00",
    quantity: 1000,
    totalVND: 25500000, // Tỷ giá 25500
    storage: "Binance",
    ticker: "USDT",
    transactionType: "Mua"
  },
  // 5. Dùng USDT mua Crypto
  {
    assetClass: "Tài sản mã hóa",
    currency: "USDT",
    date: "18/03/2026 10:00:00",
    quantity: 0.01,
    totalVND: 17850000, // 700 USDT * 25,500
    storage: "Binance",
    ticker: "BTC",
    transactionType: "Mua"
  }
];

export const mockMarketPrices = {
  USDT: { price: 25000 },
  FUEVN100: { price: 30000 },
  BTC: { price: 80000 } // BTC is 80k USD
};

export const mockExternalAssets = [
  { id: "ext1", name: "Sổ tiết kiệm", value: 50000000, group: "Thanh khoản" },
  { id: "ext2", name: "Nhà đất", value: 500000000, group: "Đầu tư" }
];

export const mockLiabilities = [
  { amount: 10000000 } // Vay nợ 10M
];

export const netWorthAssets = [
  { id: 1, name: "TOPI không kì hạn", value: 65444961, group: "Thanh khoản" },
  { id: 2, name: "Tiền mặt VP Bank", value: 36655000, group: "Thanh khoản" },
  { id: 3, name: "TOPI kì hạn 1 tháng", value: 6297507, group: "Thanh khoản" },
  { id: 4, name: "USD", value: 2217207, group: "Thanh khoản" },
  { id: 5, name: "Vàng cưới", value: 264750000, group: "Đầu tư" },
  { id: 6, name: "Trái phiếu, CCQ TP", value: 57214254, group: "Đầu tư" },
  { id: 7, name: "Crypto", value: 22715000, group: "Đầu tư" },
  { id: 8, name: "Cổ phiếu, CCQ CP", value: 10647458, group: "Đầu tư" },
  { id: 9, name: "Vàng ĐT", value: 1372509, group: "Đầu tư" }
];

export const portfolioData = [
  { ticker: "USDT", type: "Tiền mặt USD", qty: 80.63, avgCost: 26691, marketPrice: 27500, actualValue: 2217207, pnl: 65210, pnlPercent: 3.03, storage: "HL, Binance" },
  { ticker: "VFF", type: "Trái phiếu", qty: 176.32, avgCost: 24838, marketPrice: 25857, actualValue: 4559196, pnl: 179665, pnlPercent: 4.10, storage: "Fmarket" },
  { ticker: "DCBF", type: "Trái phiếu", qty: 82.22, avgCost: 27967, marketPrice: 29388, actualValue: 2416329, pnl: 116802, pnlPercent: 5.08, storage: "Fmarket" },
  { ticker: "FUEVN100", type: "Cổ phiếu", qty: 60, avgCost: 26250, marketPrice: 25360, actualValue: 1521600, pnl: -53400, pnlPercent: -3.39, storage: "SSI PRO" },
  { ticker: "FUEVFVND", type: "Cổ phiếu", qty: 60, avgCost: 39193, marketPrice: 37300, actualValue: 2238000, pnl: -113580, pnlPercent: -4.83, storage: "SSI PRO" },
  { ticker: "BTC", type: "Crypto", qty: 0.005, avgCost: 1500000000, marketPrice: 1700000000, actualValue: 8500000, pnl: 1000000, pnlPercent: 13.33, storage: "Binance" },
];

export const rebalanceData = [
  { asset: "Tiền mặt VNĐ", actualValue: 71753, targetWeight: 0, actualWeight: 0.08 },
  { asset: "Tiền mặt USD", actualValue: 2217207, targetWeight: 0, actualWeight: 2.35 },
  { asset: "Vàng", actualValue: 1372509, targetWeight: 10.00, actualWeight: 1.46 },
  { asset: "Trái phiếu", actualValue: 57214254, targetWeight: 60.00, actualWeight: 60.71 },
  { asset: "Cổ phiếu", actualValue: 10647458, targetWeight: 20.00, actualWeight: 11.30 },
  { asset: "Crypto", actualValue: 22715000, targetWeight: 10.00, actualWeight: 24.10 }
];

export const transactionData = [
  { id: "TX001", date: "30/11/2025 23:06", type: "Nạp tiền", asset: "Tiền mặt VNĐ", ticker: "VNĐ", value: 25794645, notes: "Chuyển từ file V3.1 sang" },
  { id: "TX002", date: "30/11/2025 23:09", type: "Mua", asset: "Trái phiếu", ticker: "VFF", value: 499971, notes: "Tích sản định kỳ hàng tháng" },
  { id: "TX003", date: "15/12/2025 10:30", type: "Mua", asset: "Cổ phiếu", ticker: "FUEVN100", value: 1575000, notes: "Kỳ vọng thị trường tạo đáy" },
  { id: "TX004", date: "20/12/2025 14:15", type: "Bán", asset: "Crypto", ticker: "BTC", value: 3300000, notes: "Target: Chốt lời một phần do chạm kháng cự" },
  { id: "TX005", date: "02/01/2026 09:00", type: "Mua", asset: "Vàng", ticker: "XAU", value: 8051309, notes: "Trigger: Rebalance tỷ trọng vàng" }
];
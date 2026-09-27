/**
 * Consistency checks on the transaction log — Portfolio Performance's
 * "File → Check for inconsistencies". Nothing here changes a figure: every
 * issue points at the rows to fix and says what the engine did with them.
 */
import { calculateHoldings, replayCash, TX_TYPES } from './portfolioCalculator.js';
import { replayTransactions } from './performanceEngine.js';
import { storageKey } from './accounts.js';
import { parseVNDate } from './dates.js';
import { formatVND } from './formatters.js';

const EPS = 1e-4;
/** Cash below −1.000 ₫ counts as negative (smaller gaps are price × quantity rounding). */
export const CASH_TOLERANCE = 1000;

const fmtQty = (n) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 8 }).format(n);
const describe = (tx) => `${tx.transactionType}${tx.ticker && tx.ticker !== 'VNĐ' ? ` ${tx.ticker}` : ''} ${formatVND(Math.abs(Number(tx.totalVND) || 0))}`;
const sameDay = (a, b) => String(a || '').slice(0, 10) === String(b || '').slice(0, 10);

/**
 * @returns {Array<{ id: string, level: 'warning'|'info', kind: string, title: string, detail: string, txs: Array }>}
 *   kind: oversell | negative-cash | storage-spelling | ignored-row
 */
export function findDataIssues(transactions = []) {
  const issues = [];

  // 1. Sales larger than the position held at that moment
  for (const i of replayTransactions(transactions).issues) {
    if (i.kind !== 'oversell') continue;
    issues.push({
      id: `oversell:${i.id ?? i.dateTime}:${i.ticker}`,
      level: 'warning',
      kind: 'oversell',
      title: `Bán ${i.ticker} nhiều hơn số lượng đang nắm giữ`,
      detail: `${i.dateTime}: bán ${fmtQty(i.qty)} nhưng khi đó chỉ giữ ${fmtQty(i.held)}. `
        + `Phần vượt ${fmtQty(i.excessQty)} (≈ ${formatVND(i.excessValue)}) không có giá vốn nên không được tính vào lãi/lỗ đã thực hiện. `
        + 'Có thể thiếu một lệnh Mua (hoặc khoản nhận) trước đó, hoặc số lượng bán bị nhập sai.',
      txs: [i.tx],
    });
  }

  // 2. Stretches where the cash balance is negative
  const cash = replayCash(transactions);
  let stretch = null;
  const closeStretch = (recovery) => {
    const { start, low } = stretch;
    const shortfall = formatVND(-low.balance);
    if (recovery) {
      issues.push({
        id: `negative-cash:${start.tx.id ?? start.tx.date}`,
        level: sameDay(start.tx.date, recovery.tx.date) ? 'info' : 'warning',
        kind: 'negative-cash',
        title: `Tiền mặt âm tạm thời (thiếu ${shortfall})`,
        detail: `Từ ${start.tx.date} (${describe(start.tx)}) đến ${recovery.tx.date} (${describe(recovery.tx)}). `
          + 'Lệnh mua được ghi trước khoản tiền trả cho nó. Nếu thực tế tiền về trước, hãy sửa giờ của lệnh mua.',
        txs: [start.tx, recovery.tx],
      });
    } else {
      issues.push({
        id: `negative-cash:${start.tx.id ?? start.tx.date}`,
        level: 'warning',
        kind: 'negative-cash',
        title: `Tiền mặt đang âm ${formatVND(-cash.balance)}`,
        detail: `Số dư âm từ ${start.tx.date} (${describe(start.tx)}), thấp nhất ${formatVND(low.balance)}. `
          + 'Các lệnh mua đã dùng nhiều tiền hơn số đã nạp: hãy ghi nhận khoản Nạp tiền còn thiếu.',
        txs: [start.tx],
      });
    }
    stretch = null;
  };
  for (const row of cash.rows) {
    if (row.balance < -CASH_TOLERANCE) {
      if (!stretch) stretch = { start: row, low: row };
      else if (row.balance < stretch.low.balance) stretch.low = row;
    } else if (stretch) {
      closeStretch(row);
    }
  }
  if (stretch) closeStretch(null);

  // 3. One storage written in several ways ("Binance" / "binance")
  const spellings = new Map();
  for (const tx of transactions || []) {
    if (!tx) continue;
    const name = (tx.storage || '').trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const key = storageKey(name);
    if (!spellings.has(key)) spellings.set(key, new Map());
    const variants = spellings.get(key);
    if (!variants.has(name)) variants.set(name, []);
    variants.get(name).push(tx);
  }
  for (const [key, variants] of spellings) {
    if (variants.size < 2) continue;
    const ordered = Array.from(variants.entries()).sort((a, b) => b[1].length - a[1].length);
    issues.push({
      id: `storage-spelling:${key}`,
      level: 'info',
      kind: 'storage-spelling',
      title: `Nơi lưu ký “${ordered[0][0]}” được viết theo ${variants.size} cách`,
      detail: `${ordered.map(([name, txs]) => `“${name}” (${txs.length})`).join(', ')} được gộp thành một tài khoản. Nên sửa về cùng một cách viết.`,
      txs: ordered.slice(1).flatMap(([, txs]) => txs),
    });
  }

  // 4. Buy / sell rows the engine cannot use
  for (const tx of transactions || []) {
    if (!tx || (tx.transactionType !== TX_TYPES.BUY && tx.transactionType !== TX_TYPES.SELL)) continue;
    const ticker = (tx.ticker || '').trim();
    const qty = Math.abs(Number(tx.quantity) || 0);
    let reason = null;
    if (!ticker || ticker === 'VNĐ') reason = 'không có mã tài sản nên bị bỏ qua';
    else if (qty <= EPS) reason = 'có số lượng bằng 0';
    if (!reason) continue;
    issues.push({
      id: `ignored-row:${tx.id ?? tx.date}`,
      level: 'warning',
      kind: 'ignored-row',
      title: `${tx.transactionType} ${ticker || '(không mã)'} ${reason}`,
      detail: `${tx.date}: ${describe(tx)}.`,
      txs: [tx],
    });
  }

  const rank = { warning: 0, info: 1 };
  return issues.sort((a, b) => rank[a.level] - rank[b.level]);
}

// ============================================================
// FORM HELPERS (validate a new or edited transaction)
// ============================================================

const others = (transactions, replacesId) => (transactions || [])
  .filter(t => t && (replacesId === undefined || replacesId === null || t.id !== replacesId));

/**
 * Position of `ticker` and the cash balance just before a transaction at `date`
 * (the row being edited, `replacesId`, is left out). A backdated sale is
 * checked and priced with the average cost of its own date, not today's.
 * @returns {{ qty: number, avgCost: number, cash: number }}
 */
export function positionBefore(transactions, { date, ticker }, replacesId) {
  const cutoff = parseVNDate(date).getTime();
  const before = others(transactions, replacesId).filter(t => parseVNDate(t.date).getTime() <= cutoff);
  const symbol = (ticker || '').trim().toUpperCase();
  const pos = symbol ? calculateHoldings(before).find(h => h.ticker === symbol) : null;
  return { qty: pos?.qty || 0, avgCost: pos?.avgCost || 0, cash: replayCash(before).balance };
}

/**
 * Sales that would be oversold (or more oversold than today) if `candidate`
 * were saved in place of the row `replacesId` — including later sales that a
 * backdated sale or a smaller purchase would leave without enough quantity.
 */
export function oversellsIntroducedBy(transactions, candidate, replacesId) {
  const current = new Map();
  for (const i of replayTransactions(transactions || []).issues) {
    if (i.kind === 'oversell') current.set(i.tx, i.excessQty);
  }
  const replaced = replacesId === undefined || replacesId === null ? null : (transactions || []).find(t => t && t.id === replacesId);
  const probe = { ...candidate };
  const baseline = (tx) => current.get(tx === probe ? replaced : tx) || 0;
  return replayTransactions([...others(transactions, replacesId), probe]).issues
    .filter(i => i.kind === 'oversell' && i.excessQty > baseline(i.tx) + EPS);
}

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, setDoc, onSnapshot,
  query, orderBy, where, serverTimestamp, limit
} from "firebase/firestore";
import { db } from "../firebase";

// ============================================================
// TRANSACTIONS COLLECTION
// ============================================================

const TRANSACTIONS_COL = "transactions";

export function subscribeTransactions(callback) {
  const q = query(collection(db, TRANSACTIONS_COL), orderBy("date", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.error("Error subscribing to transactions:", error);
    callback([]);
  });
}

export async function addTransaction(data) {
  const docRef = await addDoc(collection(db, TRANSACTIONS_COL), {
    ...data, createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function updateTransaction(id, data) {
  await updateDoc(doc(db, TRANSACTIONS_COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteTransaction(id) {
  await deleteDoc(doc(db, TRANSACTIONS_COL, id));
}

export async function getTransactions() {
  const q = query(collection(db, TRANSACTIONS_COL), orderBy("date", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function batchImportTransactions(transactions) {
  return Promise.all(transactions.map(t => addTransaction(t)));
}


// ============================================================
// EXTERNAL ASSETS COLLECTION
// ============================================================

const EXTERNAL_ASSETS_COL = "externalAssets";

export function subscribeExternalAssets(callback) {
  const q = query(collection(db, EXTERNAL_ASSETS_COL), orderBy("name", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error("Error subscribing to external assets:", error);
    callback([]);
  });
}

export async function addExternalAsset(data) {
  return addDoc(collection(db, EXTERNAL_ASSETS_COL), { ...data, createdAt: serverTimestamp() });
}

export async function updateExternalAsset(id, data) {
  await updateDoc(doc(db, EXTERNAL_ASSETS_COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteExternalAsset(id) {
  await deleteDoc(doc(db, EXTERNAL_ASSETS_COL, id));
}


// ============================================================
// REBALANCE TARGETS
// ============================================================

const REBALANCE_TARGETS_DOC = "settings/rebalanceTargets";

export function subscribeRebalanceTargets(callback) {
  return onSnapshot(doc(db, REBALANCE_TARGETS_DOC), (snapshot) => {
    if (snapshot.exists()) {
      const raw = snapshot.data();
      const targets = {};
      for (const [key, value] of Object.entries(raw)) {
        if (key !== 'updatedAt' && key !== 'createdAt' && typeof value === 'number') {
          targets[key] = value;
        }
      }
      callback(targets);
    } else {
      callback({
        "Tiền mặt VNĐ": 0, "Tiền mặt USD": 0,
        "Vàng": 10, "Trái phiếu": 60, "Cổ phiếu": 20, "Tài sản mã hóa": 10
      });
    }
  });
}

export async function saveRebalanceTargets(targets) {
  await setDoc(doc(db, REBALANCE_TARGETS_DOC), { ...targets, updatedAt: serverTimestamp() });
}


// ============================================================
// MARKET PRICES COLLECTION
// ============================================================

const MARKET_PRICES_COL = "marketPrices";

export function subscribeMarketPrices(callback) {
  return onSnapshot(collection(db, MARKET_PRICES_COL), (snapshot) => {
    const prices = {};
    snapshot.docs.forEach(d => { prices[d.id] = d.data(); });
    callback(prices);
  });
}

export async function updateMarketPrice(ticker, priceData) {
  await setDoc(doc(db, MARKET_PRICES_COL, ticker), {
    ...priceData, updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function batchUpdateMarketPrices(pricesMap) {
  return Promise.all(
    Object.entries(pricesMap).map(([ticker, data]) => updateMarketPrice(ticker, data))
  );
}


// ============================================================
// LIABILITIES COLLECTION (Nợ)
// ============================================================

const LIABILITIES_COL = "liabilities";

export function subscribeLiabilities(callback) {
  const q = query(collection(db, LIABILITIES_COL), orderBy("name", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error("Error subscribing to liabilities:", error);
    callback([]);
  });
}

export async function addLiability(data) {
  return addDoc(collection(db, LIABILITIES_COL), { ...data, createdAt: serverTimestamp() });
}

export async function updateLiability(id, data) {
  await updateDoc(doc(db, LIABILITIES_COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteLiability(id) {
  await deleteDoc(doc(db, LIABILITIES_COL, id));
}


// ============================================================
// DAILY SNAPSHOTS COLLECTION
// ============================================================

const SNAPSHOTS_COL = "dailySnapshots";

export function subscribeSnapshots(callback) {
  const q = query(collection(db, SNAPSHOTS_COL), orderBy("date", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error("Error subscribing to snapshots:", error);
    callback([]);
  });
}

export async function saveSnapshot(dateStr, data) {
  // Use date string as document ID for easy lookup
  const docRef = doc(db, SNAPSHOTS_COL, dateStr);
  await setDoc(docRef, { ...data, date: dateStr, updatedAt: serverTimestamp() });
}

export async function getSnapshot(dateStr) {
  const docRef = doc(db, SNAPSHOTS_COL, dateStr);
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getSnapshotsRange(startDate, endDate) {
  const q = query(
    collection(db, SNAPSHOTS_COL),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}


// ============================================================
// DAILY PRICES COLLECTION (Giá nhập tay hàng ngày)
// ============================================================

const DAILY_PRICES_COL = "dailyPrices";

export function subscribeDailyPrices(callback) {
  const q = query(collection(db, DAILY_PRICES_COL), orderBy("date", "desc"), limit(30));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error("Error subscribing to daily prices:", error);
    callback([]);
  });
}

export async function saveDailyPrices(dateStr, prices) {
  const docRef = doc(db, DAILY_PRICES_COL, dateStr);
  await setDoc(docRef, { date: dateStr, prices, updatedAt: serverTimestamp() });
}

export async function getDailyPrices(dateStr) {
  const docRef = doc(db, DAILY_PRICES_COL, dateStr);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data().prices : null;
}

export async function getLatestDailyPrices() {
  const q = query(collection(db, DAILY_PRICES_COL), orderBy("date", "desc"), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const data = snapshot.docs[0].data();
  return { date: data.date, prices: data.prices };
}


// ============================================================
// FUNDS COLLECTION (Quỹ đầu tư)
// ============================================================

const FUNDS_COL = "funds";

export function subscribeFunds(callback) {
  const q = query(collection(db, FUNDS_COL), orderBy("name", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error("Error subscribing to funds:", error);
    callback([]);
  });
}

export async function addFund(data) {
  return addDoc(collection(db, FUNDS_COL), { ...data, createdAt: serverTimestamp() });
}

export async function updateFund(id, data) {
  await updateDoc(doc(db, FUNDS_COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteFund(id) {
  await deleteDoc(doc(db, FUNDS_COL, id));
}

/**
 * Initialize default funds if none exist
 */
export async function initializeDefaultFunds() {
  const snapshot = await getDocs(collection(db, FUNDS_COL));
  if (snapshot.empty) {
    const defaults = [
      { name: "Quỹ Trái phiếu", assetClass: "Trái phiếu", cashBalance: 0, description: "Đầu tư trái phiếu và chứng chỉ quỹ TP", color: "#3b82f6" },
      { name: "Quỹ Cổ phiếu", assetClass: "Cổ phiếu", cashBalance: 0, description: "Đầu tư cổ phiếu và chứng chỉ quỹ CP", color: "#10b981" },
      { name: "Quỹ Crypto", assetClass: "Tài sản mã hóa", cashBalance: 0, description: "Đầu tư tài sản mã hóa (BTC, ETH...)", color: "#f59e0b" },
      { name: "Quỹ Vàng", assetClass: "Vàng", cashBalance: 0, description: "Đầu tư vàng vật chất và PAXG", color: "#eab308" },
      { name: "Quỹ Tiền mặt", assetClass: "Tiền mặt", cashBalance: 0, description: "Tiền mặt VNĐ và USD dự trữ", color: "#6366f1" },
    ];
    await Promise.all(defaults.map(f => addFund(f)));
    return true;
  }
  return false;
}

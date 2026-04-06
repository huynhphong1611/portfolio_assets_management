import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, setDoc, onSnapshot,
  query, orderBy, where, serverTimestamp, limit
} from "firebase/firestore";
import { db } from "../firebase";

// ============================================================
// AUTHENTICATION & USER MANAGEMENT
// ============================================================

let currentUserId = null;
let currentUserType = null;

export function setServiceUserId(userId, type = 'guest') {
  currentUserId = userId;
  currentUserType = type;
}

export function getServiceUserId() {
  return currentUserId;
}

export async function authenticateUser(username, passwordHash) {
  const usersCol = collection(db, "users");
  const q = query(usersCol, where("username", "==", username), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const userDoc = snap.docs[0];
  if (userDoc.data().passwordHash === passwordHash) {
    const userData = { id: userDoc.id, ...userDoc.data(), type: 'guest' };
    setServiceUserId(userData.id, userData.type);
    return userData;
  }
  return null;
}

export async function registerUser(username, passwordHash) {
  const usersCol = collection(db, "users");
  const q = query(usersCol, where("username", "==", username), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) throw new Error("Tên đăng nhập đã tồn tại.");
  
  const docRef = await addDoc(usersCol, {
    username,
    passwordHash,
    createdAt: serverTimestamp()
  });
  setServiceUserId(docRef.id, 'guest');
  return { id: docRef.id, username, type: 'guest' };
}

// Helpers for Sub-collections
const userCol = (name) => {
  if (!currentUserId) throw new Error("Not authenticated.");
  const root = currentUserType === 'firebase' ? "system_users" : "guest_users";
  return collection(db, root, currentUserId, name);
};
const userDocRef = (name, id) => {
  if (!currentUserId) throw new Error("Not authenticated.");
  const root = currentUserType === 'firebase' ? "system_users" : "guest_users";
  return doc(db, root, currentUserId, name, id);
};

// ============================================================
// TRANSACTIONS COLLECTION
// ============================================================

const TRANSACTIONS_COL = "transactions";

export function subscribeTransactions(callback) {
  if (!currentUserId) return () => {};
  const q = query(userCol(TRANSACTIONS_COL), orderBy("date", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.error("Error subscribing to transactions:", error);
    callback([]);
  });
}

export async function addTransaction(data) {
  const docRef = await addDoc(userCol(TRANSACTIONS_COL), {
    ...data, createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function updateTransaction(id, data) {
  await updateDoc(userDocRef(TRANSACTIONS_COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteTransaction(id) {
  await deleteDoc(userDocRef(TRANSACTIONS_COL, id));
}

export async function getTransactions() {
  const q = query(userCol(TRANSACTIONS_COL), orderBy("date", "desc"));
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
  if (!currentUserId) return () => {};
  const q = query(userCol(EXTERNAL_ASSETS_COL), orderBy("name", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error("Error subscribing to msg:", error);
    callback([]);
  });
}

export async function addExternalAsset(data) {
  return addDoc(userCol(EXTERNAL_ASSETS_COL), { ...data, createdAt: serverTimestamp() });
}

export async function updateExternalAsset(id, data) {
  await updateDoc(userDocRef(EXTERNAL_ASSETS_COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteExternalAsset(id) {
  await deleteDoc(userDocRef(EXTERNAL_ASSETS_COL, id));
}

// ============================================================
// REBALANCE TARGETS
// ============================================================

export function subscribeRebalanceTargets(callback) {
  if (!currentUserId) return () => {};
  return onSnapshot(userDocRef("settings", "rebalanceTargets"), (snapshot) => {
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
  await setDoc(userDocRef("settings", "rebalanceTargets"), { ...targets, updatedAt: serverTimestamp() });
}


// ============================================================
// MARKET PRICES COLLECTION (GLOBAL)
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
  if (!currentUserId) return () => {};
  const q = query(userCol(LIABILITIES_COL), orderBy("name", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error("Error subscribing to liabilities:", error);
    callback([]);
  });
}

export async function addLiability(data) {
  return addDoc(userCol(LIABILITIES_COL), { ...data, createdAt: serverTimestamp() });
}

export async function updateLiability(id, data) {
  await updateDoc(userDocRef(LIABILITIES_COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteLiability(id) {
  await deleteDoc(userDocRef(LIABILITIES_COL, id));
}


// ============================================================
// DAILY SNAPSHOTS COLLECTION
// ============================================================

const SNAPSHOTS_COL = "dailySnapshots";

export function subscribeSnapshots(callback) {
  if (!currentUserId) return () => {};
  const q = query(userCol(SNAPSHOTS_COL), orderBy("date", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error("Error subscribing to snapshots:", error);
    callback([]);
  });
}

export async function saveSnapshot(dateStr, data) {
  await setDoc(userDocRef(SNAPSHOTS_COL, dateStr), { ...data, date: dateStr, updatedAt: serverTimestamp() });
}

export async function getSnapshot(dateStr) {
  const snap = await getDoc(userDocRef(SNAPSHOTS_COL, dateStr));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getSnapshotsRange(startDate, endDate) {
  const q = query(
    userCol(SNAPSHOTS_COL),
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
  if (!currentUserId) return () => {};
  const q = query(userCol(DAILY_PRICES_COL), orderBy("date", "desc"), limit(30));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error("Error subscribing to daily prices:", error);
    callback([]);
  });
}

export async function saveDailyPrices(dateStr, prices) {
  await setDoc(userDocRef(DAILY_PRICES_COL, dateStr), { date: dateStr, prices, updatedAt: serverTimestamp() });
}

export async function getDailyPrices(dateStr) {
  const snap = await getDoc(userDocRef(DAILY_PRICES_COL, dateStr));
  return snap.exists() ? snap.data().prices : null;
}

export async function getLatestDailyPrices() {
  const q = query(userCol(DAILY_PRICES_COL), orderBy("date", "desc"), limit(1));
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
  if (!currentUserId) return () => {};
  const q = query(userCol(FUNDS_COL), orderBy("name", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error("Error subscribing to funds:", error);
    callback([]);
  });
}

export async function addFund(data) {
  return addDoc(userCol(FUNDS_COL), { ...data, createdAt: serverTimestamp() });
}

export async function updateFund(id, data) {
  await updateDoc(userDocRef(FUNDS_COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteFund(id) {
  await deleteDoc(userDocRef(FUNDS_COL, id));
}

export async function initializeDefaultFunds() {
  if (!currentUserId) return false;
  const snapshot = await getDocs(userCol(FUNDS_COL));
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

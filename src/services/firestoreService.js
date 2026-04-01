import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, setDoc, onSnapshot,
  query, orderBy, where, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

// ============================================================
// TRANSACTIONS COLLECTION
// ============================================================

const TRANSACTIONS_COL = "transactions";

/**
 * Subscribe to realtime transaction updates
 * @param {Function} callback - receives array of transaction docs
 * @returns {Function} unsubscribe function
 */
export function subscribeTransactions(callback) {
  const q = query(
    collection(db, TRANSACTIONS_COL),
    orderBy("date", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(items);
  }, (error) => {
    console.error("Error subscribing to transactions:", error);
    callback([]);
  });
}

/**
 * Add a new transaction
 */
export async function addTransaction(data) {
  const docData = {
    ...data,
    createdAt: serverTimestamp()
  };
  const docRef = await addDoc(collection(db, TRANSACTIONS_COL), docData);
  return docRef.id;
}

/**
 * Update an existing transaction
 */
export async function updateTransaction(id, data) {
  const docRef = doc(db, TRANSACTIONS_COL, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(id) {
  await deleteDoc(doc(db, TRANSACTIONS_COL, id));
}

/**
 * Get all transactions (one-time)
 */
export async function getTransactions() {
  const q = query(collection(db, TRANSACTIONS_COL), orderBy("date", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Batch import transactions (for CSV import)
 */
export async function batchImportTransactions(transactions) {
  const promises = transactions.map(t => addTransaction(t));
  return Promise.all(promises);
}


// ============================================================
// EXTERNAL ASSETS COLLECTION (Net Worth ngoài danh mục)
// ============================================================

const EXTERNAL_ASSETS_COL = "externalAssets";

export function subscribeExternalAssets(callback) {
  const q = query(collection(db, EXTERNAL_ASSETS_COL), orderBy("name", "asc"));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(items);
  }, (error) => {
    console.error("Error subscribing to external assets:", error);
    callback([]);
  });
}

export async function addExternalAsset(data) {
  const docData = {
    ...data,
    createdAt: serverTimestamp()
  };
  return addDoc(collection(db, EXTERNAL_ASSETS_COL), docData);
}

export async function updateExternalAsset(id, data) {
  const docRef = doc(db, EXTERNAL_ASSETS_COL, id);
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteExternalAsset(id) {
  await deleteDoc(doc(db, EXTERNAL_ASSETS_COL, id));
}


// ============================================================
// REBALANCE TARGETS COLLECTION
// ============================================================

const REBALANCE_TARGETS_DOC = "settings/rebalanceTargets";

export function subscribeRebalanceTargets(callback) {
  const docRef = doc(db, REBALANCE_TARGETS_DOC);
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    } else {
      // Default targets
      const defaults = {
        "Tiền mặt VNĐ": 0,
        "Tiền mặt USD": 0,
        "Vàng": 10,
        "Trái phiếu": 60,
        "Cổ phiếu": 20,
        "Tài sản mã hóa": 10
      };
      callback(defaults);
    }
  });
}

export async function saveRebalanceTargets(targets) {
  const docRef = doc(db, REBALANCE_TARGETS_DOC);
  await setDoc(docRef, {
    ...targets,
    updatedAt: serverTimestamp()
  });
}


// ============================================================
// MARKET PRICES COLLECTION (giá thị trường hiện tại)
// ============================================================

const MARKET_PRICES_COL = "marketPrices";

export function subscribeMarketPrices(callback) {
  return onSnapshot(collection(db, MARKET_PRICES_COL), (snapshot) => {
    const prices = {};
    snapshot.docs.forEach(doc => {
      prices[doc.id] = doc.data();
    });
    callback(prices);
  });
}

export async function updateMarketPrice(ticker, priceData) {
  const docRef = doc(db, MARKET_PRICES_COL, ticker);
  await setDoc(docRef, {
    ...priceData,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function batchUpdateMarketPrices(pricesMap) {
  const promises = Object.entries(pricesMap).map(([ticker, data]) =>
    updateMarketPrice(ticker, data)
  );
  return Promise.all(promises);
}

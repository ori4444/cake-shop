// Cart persistence that survives leaving / killing the app (notably iOS home-screen apps,
// where a localStorage write can be lost if the app is closed right after it).
// The cart is kept in both localStorage and IndexedDB with a timestamp; the newest copy wins.
const KEY = 'cake-cart';
const DB = 'cake-shop', STORE = 'kv';

const strip = cart => JSON.parse(JSON.stringify(cart, (k, v) => k === 'file' ? undefined : v));

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no idb'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet() {
  const db = await openDb();
  return new Promise(resolve => {
    const req = db.transaction(STORE).objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}
async function idbSet(value) {
  const db = await openDb();
  return new Promise(resolve => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = tx.onerror = () => resolve();
  });
}

function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(raw)) return { items: raw, savedAt: 0 }; // old format
    if (raw && Array.isArray(raw.items)) return raw;
  } catch {}
  return null;
}

export function loadCartSync() { return readLocal()?.items || []; }

// Returns the IndexedDB copy if it is newer than the localStorage one, otherwise null.
export async function loadNewerCart() {
  try {
    const local = readLocal(), idb = await idbGet();
    if (idb && Array.isArray(idb.items) && idb.savedAt > (local?.savedAt || 0)) return idb.items;
  } catch {}
  return null;
}

export function saveCart(cart) {
  const value = { items: strip(cart), savedAt: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {}
  idbSet(value).catch(() => {});
}

export function requestPersistentStorage() {
  try { navigator.storage?.persist?.(); } catch {}
}

import { Client, Account, Databases, Storage, ID, Query, Permission, Role } from 'appwrite';

// The shop uses Appwrite for both catalog and orders. Never expose the server API key here.
const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID || '6ae66bb4002feda402cd';
const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID || 'cake-images';
const productsCollection = import.meta.env.VITE_APPWRITE_PRODUCTS_COLLECTION || 'products';
const ordersCollection = import.meta.env.VITE_APPWRITE_ORDERS_COLLECTION || 'orders';
const adminId = import.meta.env.VITE_APPWRITE_ADMIN_USER_ID;
const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || '';
const client = new Client().setEndpoint(endpoint).setProject(projectId);
const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);
export const configured = Boolean(databaseId);
export const authUser = async () => { try { return await account.get(); } catch { return null; } };

export async function signIn(email, password) {
  await account.createEmailPasswordSession({ email, password });
  const user = await account.get();
  if (user.$id !== adminId || (adminEmail && user.email.toLowerCase() !== adminEmail.toLowerCase())) {
    await account.deleteSession({ sessionId: 'current' });
    throw new Error('החשבון אינו מורשה לניהול.');
  }
  return user;
}
export async function signUp() { throw new Error('הרשמת מנהלת מתבצעת דרך Appwrite בלבד.'); }
export async function signOut() { await account.deleteSession({ sessionId: 'current' }); }
export async function isAdmin() {
  const user = await authUser();
  return Boolean(user && user.$id === adminId && (!adminEmail || user.email.toLowerCase() === adminEmail.toLowerCase()));
}
export async function getProducts() {
  if (!configured) throw new Error('חסר מזהה מסד נתונים של Appwrite.');
  const result = await databases.listDocuments({ databaseId, collectionId: productsCollection, queries: [Query.equal('active', true), Query.limit(100)] });
  return result.documents.map(p => ({
    id: p.$id, name: p.name, categoryId: p.categoryId,
    description: p.description || '', price: Number(p.price),
    image: p.image, active: p.active,
  }));
}
export async function getOrders() {
  if (!(await isAdmin())) throw new Error('יש להתחבר לחשבון האדמין כדי לראות הזמנות.');
  const result = await databases.listDocuments({ databaseId, collectionId: ordersCollection, queries: [Query.orderDesc('created_at'), Query.limit(100)] });
  return result.documents.map(o => {
    let items = [];
    try { items = JSON.parse(o.items_json || '[]'); } catch {}
    return { ...o, id: o.$id, items };
  });
}
export async function changeOrder(id, status) {
  if (!(await isAdmin())) throw new Error('אין הרשאה לעדכון הזמנות.');
  return databases.updateDocument({ databaseId, collectionId: ordersCollection, documentId: id, data: { status } });
}
export async function saveProduct(data, id) {
  if (!(await isAdmin())) throw new Error('אין הרשאה לעריכת מוצרים.');
  const payload = { name: data.name, categoryId: data.categoryId, description: data.description || '',
    price: Number(data.price), image: data.image, active: true };
  if (id) return databases.updateDocument({ databaseId, collectionId: productsCollection, documentId: id, data: payload });
  return databases.createDocument({ databaseId, collectionId: productsCollection, documentId: ID.unique(), data: payload });
}
export async function disableProduct(id) {
  if (!(await isAdmin())) throw new Error('אין הרשאה למחיקת מוצרים.');
  return databases.updateDocument({ databaseId, collectionId: productsCollection, documentId: id, data: { active: false } });
}
export async function uploadImage(file, privateImage = false) {
  if (!file) throw new Error('חסרה תמונה.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024)
    throw new Error('אפשר להעלות תמונת JPG, PNG או WebP עד 8MB.');
  const permissions = privateImage
    ? [Permission.read(Role.user(adminId))]
    : [Permission.read(Role.any()), Permission.update(Role.user(adminId)), Permission.delete(Role.user(adminId))];
  const result = await storage.createFile({ bucketId, fileId: ID.unique(), file, permissions });
  if (privateImage) return result.$id;
  return storage.getFileView({ bucketId, fileId: result.$id }).toString();
}
export const getPrivateImageUrl = imageId => storage.getFileView({ bucketId, fileId: imageId }).toString();

export async function placeOrder(data) {
  const response = await fetch('/api/orders', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: data.name, phone: data.phone, requested_date: data.date || '',
      items: data.items.map(item => item.type === 'custom'
        ? { custom: true, quantity: item.quantity || 1, description: item.description || '',
            requestedAt: item.requestedAt || '', imageId: item.imageId || '' }
        : { productId: item.productId, quantity: item.quantity, note: item.note || '' })
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'שליחת ההזמנה נכשלה.');
  return result;
}
const toBase64UrlBytes = base64 => {
  const normalized = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normalized), char => char.charCodeAt(0));
};
export async function enableAdminNotifications() {
  if (!(await isAdmin())) throw new Error('יש להתחבר כאדמין.');
  if (!('serviceWorker' in navigator) || !('PushManager' in window))
    throw new Error('הדפדפן אינו תומך בהתראות Push.');
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error('חסר מפתח VAPID ציבורי בהגדרות Vercel.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('יש לאשר התראות בטלפון.');
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true, applicationServerKey: toBase64UrlBytes(publicKey),
  });
  const jwt = await account.createJWT();
  const response = await fetch('/api/push-subscriptions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt.jwt },
    body: JSON.stringify(subscription.toJSON()),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'רישום ההתראות נכשל.');
  return true;
}

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const tokenKey = 'cake-admin-session';
let session = null;
try { session = JSON.parse(localStorage.getItem(tokenKey) || 'null'); } catch {}
export const configured = Boolean(url && key);
export const authUser = () => session?.user || null;
const headers = (auth = false) => ({ apikey: key, Authorization: 'Bearer ' + (auth ? session?.access_token || key : key) });
async function request(path, options = {}, auth = false) {
  if (!configured) throw new Error('Supabase לא הוגדר ב־Vercel');
  const response = await fetch(url + path, { ...options, headers: { ...headers(auth), 'Content-Type': 'application/json', ...options.headers } });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || result?.error_description || result?.error || 'שגיאת שרת');
  return result;
}
export async function getProducts() {
  const data = await request('/rest/v1/products?select=*&active=eq.true&order=created_at.asc');
  return data.map(p => ({ ...p, categoryId: p.category_id }));
}
export async function signIn(email, password) {
  session = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  localStorage.setItem(tokenKey, JSON.stringify(session));
  const admins = await request('/rest/v1/admin_users?select=user_id&user_id=eq.' + encodeURIComponent(session.user.id), {}, true);
  if (!admins.length) { signOut(); throw new Error('החשבון אינו מורשה לניהול'); }
  return session.user;
}
export function signOut() { session = null; localStorage.removeItem(tokenKey); }
export async function isAdmin() {
  if (!session?.access_token) return false;
  try {
    const data = await request('/rest/v1/admin_users?select=user_id&user_id=eq.' + encodeURIComponent(session.user.id), {}, true);
    return data.length > 0;
  } catch { signOut(); return false; }
}
export async function getOrders() { return request('/rest/v1/orders?select=*&order=created_at.desc&limit=100', {}, true); }
export async function changeOrder(id, status) { return request('/rest/v1/orders?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status }) }, true); }
export async function saveProduct(data, id) {
  const body = { name: data.name, category_id: data.categoryId, description: data.description, price: Number(data.price), image: data.image, active: true };
  return request('/rest/v1/products' + (id ? '?id=eq.' + encodeURIComponent(id) : ''), {
    method: id ? 'PATCH' : 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(id ? body : { ...body, id: crypto.randomUUID() })
  }, true);
}
export async function disableProduct(id) { return request('/rest/v1/products?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ active: false }) }, true); }
export async function uploadImage(file) {
  const path = crypto.randomUUID() + '-' + file.name.replace(/[^a-zA-Z0-9.]/g, '');
  const response = await fetch(url + '/storage/v1/object/cake-images/' + path, { method: 'POST', headers: { ...headers(true), 'Content-Type': file.type }, body: file });
  if (!response.ok) throw new Error('העלאת התמונה נכשלה');
  return url + '/storage/v1/object/public/cake-images/' + path;
}
export async function placeOrder(data) {
  return request('/rest/v1/rpc/place_order', { method: 'POST', body: JSON.stringify({
    p_name: data.name, p_phone: data.phone, p_date: data.date || null,
    p_items: data.items.map(item => item.type === 'custom' ?
      { custom: true, description: item.description, note: item.note, image: item.image?.startsWith('https://') ? item.image : '', quantity: item.quantity } :
      { productId: item.productId, quantity: item.quantity, note: item.note })
  }) });
}

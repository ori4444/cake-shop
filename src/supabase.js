const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const tokenKey = 'cake-admin-session';
let session = null;
try { session = JSON.parse(localStorage.getItem(tokenKey) || 'null'); } catch {}
export const configured = Boolean(url && key);
export const authUser = () => session?.user || null;
export const accessToken = () => session?.access_token || null;
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
export async function getCategoryImages() {
 return request('/rest/v1/category_images?select=category_id,image');
}
export async function saveCategoryImage(categoryId, image) {
 return request('/rest/v1/category_images?on_conflict=category_id', {
  method:'POST',
  headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
  body:JSON.stringify({category_id:categoryId,image})
 });
}
export async function signIn(email, password, setupCode = '') {
  session = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  localStorage.setItem(tokenKey, JSON.stringify(session));
  try {
    if (setupCode.trim()) await claimInitialAdmin(setupCode.trim());
    const admins = await request('/rest/v1/admin_users?select=user_id&user_id=eq.' + encodeURIComponent(session.user.id), {}, true);
    if (!admins.length) throw new Error('החשבון אינו מורשה לניהול. בהרשמה ראשונה יש להזין קוד הקמה.');
    return session.user;
  } catch(error) {
    signOut();
    throw error;
  }
}
async function claimInitialAdmin(code) {
  return request('/rest/v1/rpc/claim_initial_admin', {
    method: 'POST',
    body: JSON.stringify({ setup_code: code })
  }, true);
}
export async function signUp(email, password, setupCode) {
  if (!configured) throw new Error('Supabase לא הוגדר ב־Vercel');
  const result = await request('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password })
  });
  if (result.access_token) {
    session = result;
    localStorage.setItem(tokenKey, JSON.stringify(session));
    try {
      await claimInitialAdmin(setupCode.trim());
      return { activated: true, user: result.user };
    } catch (error) {
      signOut();
      throw error;
    }
  }
  return { activated: false };
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
export async function deleteOrder(id) { return request('/rest/v1/orders?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }, true); }
export async function saveProduct(data, id) {
  const body = { name: data.name, category_id: data.categoryId, description: data.description, price: Number(data.price), image: data.image, active: true };
  return request('/rest/v1/products' + (id ? '?id=eq.' + encodeURIComponent(id) : ''), {
    method: id ? 'PATCH' : 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(id ? body : { ...body, id: crypto.randomUUID() })
  }, true);
}
export async function disableProduct(id) { return request('/rest/v1/products?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ active: false }) }, true); }
export async function uploadImage(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024)
    throw new Error('אפשר להעלות תמונות JPG, PNG או WebP עד 8MB.');
  const path = crypto.randomUUID() + '-' + file.name.replace(/[^a-zA-Z0-9.]/g, '');
  const response = await fetch(url + '/storage/v1/object/cake-images/' + path, { method: 'POST', headers: { ...headers(true), 'Content-Type': file.type }, body: file });
  if (!response.ok) throw new Error('העלאת התמונה נכשלה');
  return url + '/storage/v1/object/public/cake-images/' + path;
}
export async function placeOrder(data) {
  const result = await request('/rest/v1/rpc/place_order', { method: 'POST', body: JSON.stringify({
    p_name: data.name, p_phone: data.phone, p_date: data.date ? data.date.slice(0,10) : null,
    p_items: data.items.map(item => item.type === 'custom' ?
      { custom: true, description: item.description, note: '', image: item.uploadedImage || '', quantity: item.quantity } :
      { productId: item.productId, quantity: item.quantity, note: item.note })
  }) });
  // Best-effort: the order is already saved, so a failed notification must never fail the checkout.
  fetch('/api/notify-order', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_name: data.name, item_count: data.items.length }) }).catch(() => {});
  return result;
}

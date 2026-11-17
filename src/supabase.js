const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
async function request(path, options = {}) {
  if (!configured) throw new Error('Supabase לא הוגדר ב־Vercel');
  const response = await fetch(url + path, { ...options, headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...options.headers } });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || result?.error_description || result?.error || 'שגיאת שרת');
  return result;
}
// Admin writes (orders/products/category images) need the service-role key, which never
// reaches the browser; they go through our own /api/* functions instead of Supabase directly.
async function adminRequest(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || result?.message || 'שגיאת שרת');
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
  return adminRequest('/api/category-images', { method: 'POST', body: JSON.stringify({ categoryId, image }) });
}
export async function getOrders() { return request('/rest/v1/orders?select=*&order=created_at.desc&limit=100'); }
export async function deleteOrder(id) { return adminRequest('/api/orders?id=' + encodeURIComponent(id), { method: 'DELETE' }); }
export async function saveProduct(data, id) {
  const body = { name: data.name, categoryId: data.categoryId, description: data.description, price: data.price, image: data.image };
  return adminRequest('/api/products' + (id ? '?id=' + encodeURIComponent(id) : ''), {
    method: id ? 'PATCH' : 'POST', body: JSON.stringify(body),
  });
}
export async function disableProduct(id) { return adminRequest('/api/products?id=' + encodeURIComponent(id), { method: 'DELETE' }); }
export async function uploadImage(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024)
    throw new Error('אפשר להעלות תמונות JPG, PNG או WebP עד 8MB.');
  const path = crypto.randomUUID() + '-' + file.name.replace(/[^a-zA-Z0-9.]/g, '');
  const response = await fetch(url + '/storage/v1/object/cake-images/' + path, { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': file.type }, body: file });
  if (!response.ok) throw new Error('העלאת התמונה נכשלה');
  return url + '/storage/v1/object/public/cake-images/' + path;
}
export async function placeOrder(data) {
  const typeLabel = data.type === 'direct' ? 'הזמנה ישירה' : 'הזמנת מארז';
  // The order-type tag rides inside the first item's note/description because those fields
  // are already known to survive the place_order RPC round-trip (the admin screen renders
  // them today); there is no separate column for it and the RPC's own source isn't in this repo.
  const items = data.items.map((item, index) => {
    const mapped = item.type === 'custom' ?
      { custom: true, description: item.description, note: '', image: item.uploadedImage || '', quantity: item.quantity } :
      { productId: item.productId, quantity: item.quantity, note: item.note };
    if (index !== 0) return mapped;
    const tag = `סוג הזמנה: ${typeLabel}`;
    return mapped.custom
      ? { ...mapped, description: mapped.description ? `${tag} — ${mapped.description}` : tag }
      : { ...mapped, note: mapped.note ? `${tag} — ${mapped.note}` : tag };
  });
  const result = await request('/rest/v1/rpc/place_order', { method: 'POST', body: JSON.stringify({
    p_name: data.name, p_phone: data.phone, p_date: data.date ? data.date.slice(0,10) : null, p_items: items
  }) });
  const hasUnknownPrice = data.items.some(item => item.price == null);
  const total = hasUnknownPrice ? null : data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // Best-effort: the order is already saved, so a failed notification must never fail the checkout.
  fetch('/api/notify-order', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: data.name, phone: data.phone, requested_date: data.date, order_type: typeLabel,
      items: data.items.map(item => ({ name: item.name, image: item.uploadedImage || item.image || '', price: item.price ?? null, quantity: item.quantity })),
      total,
    }) }).catch(() => {});
  return result;
}

import webpush from 'web-push';
import { appwrite, config, docId, adminPermissions } from './_appwrite.js';

const json = (res, status, data) => res.status(status).setHeader('Content-Type', 'application/json').json(data);

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  try {
    const c = config();
    const { customer_name, phone, requested_date = '', items } = req.body || {};
    if (typeof customer_name !== 'string' || customer_name.trim().length < 2 || customer_name.length > 100) return json(res, 400, { error: 'נא למלא שם תקין.' });
    if (typeof phone !== 'string' || phone.replace(/\D/g, '').length < 9 || phone.length > 30) return json(res, 400, { error: 'נא למלא מספר טלפון תקין.' });
    if (!Array.isArray(items) || !items.length || items.length > 30) return json(res, 400, { error: 'אין פריטים תקינים להזמנה.' });

    const storedItems = [];
    let total = 0;
    let hasCustom = false;
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) return json(res, 400, { error: 'כמות מוצר לא תקינה.' });
      if (item.custom === true) {
        hasCustom = true;
        storedItems.push({ custom: true, name: 'עוגה בעיצוב אישי', description: String(item.description || '').slice(0, 1000), note: String(item.note || '').slice(0, 500), quantity, imageId: String(item.imageId || '') });
        continue;
      }
      const productId = String(item.productId || '');
      if (!/^[A-Za-z0-9_-]{1,36}$/.test(productId)) return json(res, 400, { error: 'מוצר לא תקין.' });
      const product = await appwrite(`/databases/${encodeURIComponent(c.database)}/collections/${encodeURIComponent(process.env.APPWRITE_PRODUCTS_COLLECTION || 'products')}/documents/${encodeURIComponent(productId)}`);
      if (product.active === false) return json(res, 400, { error: 'המוצר אינו זמין כרגע.' });
      const price = Number(product.price);
      if (!Number.isFinite(price) || price < 0) return json(res, 400, { error: 'מחיר המוצר אינו תקין.' });
      total += price * quantity;
      storedItems.push({ custom: false, productId, name: product.name, unit_price: price, note: String(item.note || '').slice(0, 500), quantity });
    }

    const collection = encodeURIComponent(process.env.APPWRITE_ORDERS_COLLECTION || 'orders');
    const order = await appwrite(`/databases/${encodeURIComponent(c.database)}/collections/${collection}/documents`, {
      method: 'POST',
      body: JSON.stringify({ documentId: docId(), data: {
        customer_name: customer_name.trim(), phone: phone.trim(), requested_date: String(requested_date).slice(0, 30),
        items_json: JSON.stringify(storedItems), total, has_custom: hasCustom, status: 'new', created_at: new Date().toISOString(),
      }, permissions: adminPermissions() }),
    });

    await notifyAdmin(c, customer_name.trim(), storedItems.length).catch(err => console.error('Push notification failed:', err));
    return json(res, 201, { ok: true, id: order.$id });
  } catch (error) {
    console.error('Order save failed:', error);
    return json(res, 500, { error: 'שמירת ההזמנה נכשלה. בדקו את הגדרות Appwrite ונסו שוב.' });
  }
}

async function notifyAdmin(c, name, count) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const col = encodeURIComponent(process.env.APPWRITE_PUSH_COLLECTION || 'push_subscriptions');
  const query = encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] }));
  const list = await appwrite(`/databases/${encodeURIComponent(c.database)}/collections/${col}/documents?queries[]=${query}`);
  const payload = JSON.stringify({ title: 'התקבלה הזמנה חדשה', body: `${name} שלח/ה הזמנה עם ${count} פריטים`, url: '/admin', tag: `order-${Date.now()}` });
  await Promise.all((list.documents || []).map(async document => {
    const subscription = { endpoint: document.endpoint, keys: { p256dh: document.p256dh, auth: document.auth } };
    try { await webpush.sendNotification(subscription, payload); }
    catch (error) {
      if ([404, 410].includes(error.statusCode)) {
        await appwrite(`/databases/${encodeURIComponent(c.database)}/collections/${col}/documents/${encodeURIComponent(document.$id)}`, { method: 'DELETE' }).catch(() => {});
      } else throw error;
    }
  }));
}

import webpush from 'web-push';
import { supabaseAdmin } from './_supabase.js';

const json = (res, status, data) => res.status(status).setHeader('Content-Type', 'application/json').json(data);
const money = n => `₪${Math.round(n)}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  try {
    const { customer_name, phone, requested_date, order_type, items, total } = req.body || {};
    if (typeof customer_name !== 'string' || customer_name.trim().length < 2 || customer_name.length > 100)
      return json(res, 400, { error: 'שם לא תקין.' });
    if (!Array.isArray(items) || !items.length || items.length > 50) return json(res, 400, { error: 'פריטים לא תקינים.' });

    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) return json(res, 200, { ok: true });
    webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

    const lines = [];
    if (typeof order_type === 'string' && order_type.trim()) lines.push(String(order_type).slice(0, 40));
    lines.push('מוצרים: ' + items.slice(0, 10).map(item => {
      const name = String(item?.name || 'מוצר').slice(0, 60);
      const quantity = Number(item?.quantity) > 0 ? Number(item.quantity) : 1;
      const price = Number.isFinite(Number(item?.price)) && item?.price != null ? money(Number(item.price) * quantity) : null;
      return price ? `${name} ×${quantity} (${price})` : `${name} ×${quantity}`;
    }).join(', '));
    if (Number.isFinite(Number(total)) && total != null) lines.push(`סה״כ: ${money(Number(total))}`);
    if (typeof phone === 'string' && phone.trim()) lines.push(`טלפון: ${phone.trim().slice(0, 30)}`);
    if (typeof requested_date === 'string' && requested_date.trim()) lines.push(`תאריך נדרש: ${requested_date.trim().slice(0, 30)}`);

    const subscriptions = await supabaseAdmin('/rest/v1/push_subscriptions?select=*');
    const heroImage = items.map(item => item?.image).find(image => typeof image === 'string' && image.startsWith('https://'));
    const payload = JSON.stringify({
      title: `הזמנה חדשה מ${customer_name.trim()}`,
      body: lines.join('\n').slice(0, 1000),
      url: '/admin', tag: `order-${Date.now()}`,
      ...(heroImage ? { image: heroImage } : {}),
    });
    await Promise.all((subscriptions || []).map(async subscription => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload);
      } catch (error) {
        if ([404, 410].includes(error.statusCode)) {
          await supabaseAdmin(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}`, { method: 'DELETE' }).catch(() => {});
        }
      }
    }));
    return json(res, 200, { ok: true });
  } catch (error) {
    // Best-effort: a notification failure must never surface as a failed order to the customer.
    console.error('Order notification failed:', error);
    return json(res, 200, { ok: false });
  }
}

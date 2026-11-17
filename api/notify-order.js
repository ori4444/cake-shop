import webpush from 'web-push';
import { supabaseAdmin } from './_supabase.js';

const json = (res, status, data) => res.status(status).setHeader('Content-Type', 'application/json').json(data);

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  try {
    const { customer_name, item_count } = req.body || {};
    if (typeof customer_name !== 'string' || customer_name.trim().length < 2 || customer_name.length > 100)
      return json(res, 400, { error: 'שם לא תקין.' });
    const count = Number(item_count);
    if (!Number.isInteger(count) || count < 1 || count > 50) return json(res, 400, { error: 'כמות פריטים לא תקינה.' });

    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) return json(res, 200, { ok: true });
    webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

    const subscriptions = await supabaseAdmin('/rest/v1/push_subscriptions?select=*');
    const payload = JSON.stringify({
      title: 'התקבלה הזמנה חדשה',
      body: `${customer_name.trim()} שלח/ה הזמנה עם ${count} פריטים`,
      url: '/admin', tag: `order-${Date.now()}`,
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

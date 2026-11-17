import { supabaseAdmin } from './_supabase.js';

const json = (res, status, data) => res.status(status).setHeader('Content-Type', 'application/json').json(data);

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  try {
    const { endpoint, keys } = req.body || {};
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !keys?.p256dh || !keys?.auth)
      return json(res, 400, { error: 'פרטי Push לא תקינים.' });
    await supabaseAdmin('/rest/v1/push_subscriptions?on_conflict=endpoint', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth, created_at: new Date().toISOString() }),
    });
    return json(res, 200, { ok: true });
  } catch (error) {
    const status = error.status || 500;
    console.error('Push subscription failed:', error);
    return json(res, status, { error: status < 500 ? error.message : 'רישום ההתראות נכשל.' });
  }
}

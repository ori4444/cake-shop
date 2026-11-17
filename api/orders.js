import { supabaseAdmin } from './_supabase.js';

const json = (res, status, data) => res.status(status).setHeader('Content-Type', 'application/json').json(data);

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return json(res, 405, { error: 'Method not allowed.' });
  try {
    const id = String(req.query.id || '');
    if (!id) return json(res, 400, { error: 'מזהה הזמנה חסר.' });
    await supabaseAdmin(`/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: { Prefer: 'return=minimal' },
    });
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('Order delete failed:', error);
    return json(res, 500, { error: 'מחיקת ההזמנה נכשלה.' });
  }
}

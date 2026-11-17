import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from './_supabase.js';

const json = (res, status, data) => res.status(status).setHeader('Content-Type', 'application/json').json(data);

export default async function handler(req, res) {
  try {
    const id = String(req.query.id || '');
    if (req.method === 'DELETE') {
      if (!id) return json(res, 400, { error: 'מזהה מוצר חסר.' });
      await supabaseAdmin(`/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify({ active: false }),
      });
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' || req.method === 'PATCH') {
      const data = req.body || {};
      if (!data.name || !data.categoryId || data.price == null) return json(res, 400, { error: 'נתוני מוצר לא תקינים.' });
      const body = { name: data.name, category_id: data.categoryId, description: data.description || '', price: Number(data.price), image: data.image || '', active: true };
      await supabaseAdmin('/rest/v1/products' + (req.method === 'PATCH' && id ? `?id=eq.${encodeURIComponent(id)}` : ''), {
        method: req.method, headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(req.method === 'POST' ? { ...body, id: randomUUID() } : body),
      });
      return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error('Product save failed:', error);
    return json(res, 500, { error: 'שמירת המוצר נכשלה.' });
  }
}

import { supabaseAdmin } from './_supabase.js';

const json = (res, status, data) => res.status(status).setHeader('Content-Type', 'application/json').json(data);

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  try {
    const { categoryId, image } = req.body || {};
    if (!categoryId || !image) return json(res, 400, { error: 'נתוני תמונה לא תקינים.' });
    await supabaseAdmin('/rest/v1/category_images?on_conflict=category_id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ category_id: categoryId, image }),
    });
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('Category image save failed:', error);
    return json(res, 500, { error: 'שמירת תמונת הקטגוריה נכשלה.' });
  }
}

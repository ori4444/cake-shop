import { createHash } from 'node:crypto';
import { appwrite, config, adminPermissions } from './_appwrite.js';

const json = (res, status, data) => res.status(status).setHeader('Content-Type', 'application/json').json(data);

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  try {
    const c = config();
    const jwt = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json(res, 401, { error: 'נדרשת התחברות למנהלת.' });
    const account = await fetch(`${c.endpoint}/account`, { headers: { 'X-Appwrite-Project': c.project, 'X-Appwrite-JWT': jwt } });
    const user = await account.json().catch(() => ({}));
    if (!account.ok || user.$id !== c.adminId || user.email?.toLowerCase() !== (process.env.APPWRITE_ADMIN_EMAIL || '').toLowerCase()) return json(res, 403, { error: 'אין הרשאה לרישום מכשיר.' });
    const { endpoint, keys } = req.body || {};
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !keys?.p256dh || !keys?.auth) return json(res, 400, { error: 'פרטי Push לא תקינים.' });
    const collection = encodeURIComponent(process.env.APPWRITE_PUSH_COLLECTION || 'push_subscriptions');
    const documentId = createHash('sha256').update(endpoint).digest('hex').slice(0, 32);
    const path = `/databases/${encodeURIComponent(c.database)}/collections/${collection}/documents`;
    const data = { documentId, data: { endpoint, p256dh: keys.p256dh, auth: keys.auth, created_at: new Date().toISOString() }, permissions: adminPermissions(user.$id) };
    try {
      await appwrite(path, { method: 'POST', body: JSON.stringify(data) });
    } catch (error) {
      if (!/already exists|document with the requested ID/i.test(error.message)) throw error;
      await appwrite(`${path}/${documentId}`, { method: 'PATCH', body: JSON.stringify({ data: data.data, permissions: data.permissions }) });
    }
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('Push subscription failed:', error);
    return json(res, 500, { error: 'רישום ההתראות נכשל. בדקו את הגדרות Appwrite.' });
  }
}

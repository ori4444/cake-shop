import { randomUUID } from 'node:crypto';

export const config = () => {
  const endpoint = (process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1').replace(/\/$/, '');
  const project = process.env.APPWRITE_PROJECT_ID || '6ae66bb4002feda402cd';
  const database = process.env.APPWRITE_DATABASE_ID;
  const key = process.env.APPWRITE_API_KEY;
  const adminId = process.env.APPWRITE_ADMIN_USER_ID;
  if (!database || !key || !adminId) throw new Error('Appwrite server configuration is incomplete.');
  return { endpoint, project, database, key, adminId };
};

export async function appwrite(path, options = {}) {
  const c = config();
  const response = await fetch(`${c.endpoint}${path}`, {
    ...options,
    headers: {
      'X-Appwrite-Project': c.project,
      'X-Appwrite-Key': c.key,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Appwrite request failed (${response.status}).`);
  return data;
}

export const docId = () => randomUUID().replaceAll('-', '').slice(0, 32);
export const adminPermissions = (id = config().adminId) => [`read("user:${id}")`, `update("user:${id}")`];

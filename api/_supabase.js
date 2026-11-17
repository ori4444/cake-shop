const config = () => {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Supabase server configuration is incomplete.');
  return { url, serviceKey };
};

export async function supabaseAdmin(path, options = {}) {
  const { url, serviceKey } = config();
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || `Supabase request failed (${response.status}).`);
  return data;
}


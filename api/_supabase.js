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

export async function requireAdmin(req) {
  const { url, serviceKey } = config();
  const jwt = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) throw Object.assign(new Error('נדרשת התחברות למנהלת.'), { status: 401 });
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${jwt}` } });
  const user = await userResponse.json().catch(() => ({}));
  if (!userResponse.ok || !user?.id) throw Object.assign(new Error('נדרשת התחברות למנהלת.'), { status: 401 });
  const admins = await supabaseAdmin(`/rest/v1/admin_users?select=user_id&user_id=eq.${encodeURIComponent(user.id)}`);
  if (!admins.length) throw Object.assign(new Error('אין הרשאה.'), { status: 403 });
  return user;
}

const COOKIE_NAME = 'inzumos_admin_session';

export const getConfig = () => ({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
  adminEmail: (process.env.ADMIN_EMAIL || 'robin_vt.19@hotmail.com').toLowerCase()
});

export const readCookie = (request) => {
  const cookies = String(request.headers.cookie || '').split(';');
  const entry = cookies.find((cookie) => cookie.trim().startsWith(`${COOKIE_NAME}=`));
  return entry ? decodeURIComponent(entry.trim().slice(COOKIE_NAME.length + 1)) : '';
};

export const sessionCookie = (token, maxAge = 3600) =>
  `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

export const clearSessionCookie = () =>
  `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export async function requireAdmin(request, response) {
  const { supabaseUrl, supabaseSecretKey, adminEmail } = getConfig();
  const token = readCookie(request);

  if (!supabaseUrl || !supabaseSecretKey) {
    response.status(503).json({ error: 'El administrador no está configurado.' });
    return null;
  }
  if (!token) {
    response.status(401).json({ error: 'Inicia sesión para continuar.' });
    return null;
  }

  try {
    const result = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseSecretKey, Authorization: `Bearer ${token}` }
    });
    if (!result.ok) throw new Error('Sesión inválida');
    const user = await result.json();
    if (String(user.email || '').toLowerCase() !== adminEmail) {
      response.setHeader('Set-Cookie', clearSessionCookie());
      response.status(403).json({ error: 'Este usuario no tiene acceso al administrador.' });
      return null;
    }
    return { user, supabaseUrl, supabaseSecretKey };
  } catch {
    response.setHeader('Set-Cookie', clearSessionCookie());
    response.status(401).json({ error: 'La sesión venció. Inicia sesión nuevamente.' });
    return null;
  }
}

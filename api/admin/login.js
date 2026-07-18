import { getConfig, sessionCookie } from './_auth.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Método no permitido.' });
  }

  const { supabaseUrl, supabaseSecretKey, adminEmail } = getConfig();
  const email = String(request.body?.email || '').trim().toLowerCase();
  const password = String(request.body?.password || '');
  if (!supabaseUrl || !supabaseSecretKey) return response.status(503).json({ error: 'El administrador no está configurado.' });
  if (email !== adminEmail) return response.status(403).json({ error: 'Credenciales incorrectas.' });

  try {
    const result = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: supabaseSecretKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await result.json().catch(() => ({}));
    if (!result.ok || !data.access_token) return response.status(401).json({ error: 'Correo o contraseña incorrectos.' });

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Set-Cookie', sessionCookie(data.access_token, data.expires_in || 3600));
    return response.status(200).json({ ok: true, email });
  } catch {
    return response.status(502).json({ error: 'No fue posible iniciar sesión.' });
  }
}

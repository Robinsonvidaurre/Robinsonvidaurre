import { requireAdmin } from './_auth.js';

const STATUSES = ['nuevo', 'contactado', 'cotizado', 'cerrado', 'descartado'];

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const auth = await requireAdmin(request, response);
  if (!auth) return;
  const headers = {
    apikey: auth.supabaseSecretKey,
    Authorization: `Bearer ${auth.supabaseSecretKey}`,
    'Content-Type': 'application/json'
  };

  if (request.method === 'GET') {
    const result = await fetch(`${auth.supabaseUrl}/rest/v1/quotes?select=*&order=created_at.desc&limit=500`, { headers });
    if (!result.ok) return response.status(502).json({ error: 'No fue posible cargar las cotizaciones.' });
    return response.status(200).json({ quotes: await result.json(), user: auth.user.email });
  }

  if (request.method === 'PATCH') {
    const id = String(request.body?.id || '');
    const status = String(request.body?.status || '');
    if (!/^[0-9a-f-]{36}$/i.test(id) || !STATUSES.includes(status)) {
      return response.status(400).json({ error: 'Actualización inválida.' });
    }
    const result = await fetch(`${auth.supabaseUrl}/rest/v1/quotes?id=eq.${id}`, {
      method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify({ status })
    });
    if (!result.ok) return response.status(502).json({ error: 'No fue posible actualizar la cotización.' });
    return response.status(200).json({ quote: (await result.json())[0] });
  }

  response.setHeader('Allow', 'GET, PATCH');
  return response.status(405).json({ error: 'Método no permitido.' });
}

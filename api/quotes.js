const REQUIRED_FIELDS = ['name', 'business', 'phone', 'email', 'city', 'category', 'products'];

const clean = (value, maxLength = 500) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Método no permitido.' });
  }

  const body = request.body || {};
  if (body.website) return response.status(200).json({ ok: true });

  const missing = REQUIRED_FIELDS.filter((field) => !clean(body[field]));
  if (missing.length || body.consent !== true) {
    return response.status(400).json({ error: 'Completa todos los campos obligatorios.' });
  }

  const email = clean(body.email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseSecretKey) {
    return response.status(503).json({ error: 'El servicio de cotizaciones aún no está configurado.' });
  }

  const record = {
    contact_name: clean(body.name, 120),
    business_name: clean(body.business, 160),
    phone: clean(body.phone, 40),
    email,
    city: clean(body.city, 120),
    district: clean(body.district, 120) || null,
    category: clean(body.category, 80),
    products: clean(body.products, 3000),
    delivery_date: clean(body.deliveryDate, 10) || null,
    frequency: clean(body.frequency, 40) || null,
    comments: clean(body.comments, 3000) || null,
    consent: true,
    source: 'vercel-web'
  };

  try {
    const result = await fetch(`${supabaseUrl}/rest/v1/quotes`, {
      method: 'POST',
      headers: {
        apikey: supabaseSecretKey,
        Authorization: `Bearer ${supabaseSecretKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(record)
    });

    if (!result.ok) {
      console.error('Supabase insert failed', result.status, await result.text());
      return response.status(502).json({ error: 'No pudimos registrar la solicitud.' });
    }

    return response.status(201).json({ ok: true });
  } catch (error) {
    console.error('Quote API failed', error);
    return response.status(500).json({ error: 'No pudimos registrar la solicitud.' });
  }
}


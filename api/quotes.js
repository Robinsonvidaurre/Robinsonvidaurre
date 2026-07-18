const REQUIRED_FIELDS = ['name', 'business', 'phone', 'email', 'city', 'category', 'products'];

const clean = (value, maxLength = 500) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const updateEmailDelivery = async (supabaseUrl, supabaseSecretKey, quoteId, fields) => {
  await fetch(`${supabaseUrl}/rest/v1/quotes?id=eq.${quoteId}`, {
    method: 'PATCH',
    headers: {
      apikey: supabaseSecretKey,
      Authorization: `Bearer ${supabaseSecretKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(fields)
  });
};

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
        Prefer: 'return=representation'
      },
      body: JSON.stringify(record)
    });

    if (!result.ok) {
      console.error('Supabase insert failed', result.status, await result.text());
      return response.status(502).json({ error: 'No pudimos registrar la solicitud.' });
    }

    const [savedQuote] = await result.json();
    const resendApiKey = process.env.RESEND_API_KEY;
    let emailSent = false;

    if (resendApiKey && savedQuote?.id) {
      const notificationEmail = process.env.QUOTE_NOTIFICATION_EMAIL || 'robin_vt.19@hotmail.com';
      const sender = process.env.RESEND_FROM_EMAIL || 'INZUMOS <onboarding@resend.dev>';
      const emailHtml = `
        <div style="font-family:Arial,sans-serif;color:#17372d;line-height:1.55;max-width:680px">
          <h1 style="font-family:Georgia,serif">Nueva solicitud de cotización</h1>
          <p><strong>Negocio:</strong> ${escapeHtml(record.business_name)}</p>
          <p><strong>Contacto:</strong> ${escapeHtml(record.contact_name)}</p>
          <p><strong>Teléfono / WhatsApp:</strong> ${escapeHtml(record.phone)}</p>
          <p><strong>Correo:</strong> ${escapeHtml(record.email)}</p>
          <p><strong>Ubicación:</strong> ${escapeHtml(record.city)}${record.district ? ` · ${escapeHtml(record.district)}` : ''}</p>
          <hr style="border:0;border-top:1px solid #d9dfd6;margin:24px 0">
          <p><strong>Categoría:</strong> ${escapeHtml(record.category)}</p>
          <p><strong>Productos y cantidades:</strong><br>${escapeHtml(record.products).replaceAll('\n', '<br>')}</p>
          <p><strong>Fecha requerida:</strong> ${escapeHtml(record.delivery_date || 'No indicada')}</p>
          <p><strong>Frecuencia:</strong> ${escapeHtml(record.frequency || 'No indicada')}</p>
          <p><strong>Comentarios:</strong><br>${escapeHtml(record.comments || 'Ninguno').replaceAll('\n', '<br>')}</p>
          <p style="margin-top:28px;font-size:12px;color:#64756f">ID de cotización: ${escapeHtml(savedQuote.id)}</p>
        </div>`;

      const emailResult = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `quote-${savedQuote.id}`
        },
        body: JSON.stringify({
          from: sender,
          to: [notificationEmail],
          reply_to: record.email,
          subject: `Nueva cotización - ${record.business_name}`,
          html: emailHtml
        })
      });

      const emailResponse = await emailResult.json().catch(() => ({}));
      emailSent = emailResult.ok;

      if (emailSent) {
        await updateEmailDelivery(supabaseUrl, supabaseSecretKey, savedQuote.id, {
          email_sent_at: new Date().toISOString(),
          email_delivery_id: emailResponse.id || null,
          email_error: null
        });
      } else {
        const emailError = clean(emailResponse.message || emailResponse.name || 'Resend rechazó el correo', 500);
        console.error('Resend notification failed', emailResult.status, emailError);
        await updateEmailDelivery(supabaseUrl, supabaseSecretKey, savedQuote.id, {
          email_error: emailError
        });
      }
    }

    return response.status(201).json({ ok: true, emailSent });
  } catch (error) {
    console.error('Quote API failed', error);
    return response.status(500).json({ error: 'No pudimos registrar la solicitud.' });
  }
}

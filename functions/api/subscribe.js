// POST /api/subscribe — adds subscriber to MailerLite group "yarinmalka.co.il"
// Body: { email: string, name?: string }

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), { status: 400, headers: cors });
  }

  const email = (body.email || '').trim();
  const name  = (body.name  || '').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_email' }), { status: 400, headers: cors });
  }

  if (!env.MAILERLITE_TOKEN || !env.MAILERLITE_GROUP_ID) {
    return new Response(JSON.stringify({ ok: false, error: 'server_misconfigured' }), { status: 500, headers: cors });
  }

  const mlRes = await fetch('https://connect.mailerlite.com/api/subscribers', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.MAILERLITE_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      email,
      fields: name ? { name } : undefined,
      groups: [env.MAILERLITE_GROUP_ID],
      status: 'active',
    }),
  });

  if (!mlRes.ok) {
    const errText = await mlRes.text();
    return new Response(JSON.stringify({ ok: false, error: 'mailerlite_failed', detail: errText.slice(0, 200) }), { status: 502, headers: cors });
  }

  // Notify Yarin of the new signup (reuses the contact-notification webhook → email).
  // Non-blocking: a notification failure must never fail the signup itself.
  if (env.MAKE_WEBHOOK_URL) {
    try {
      await fetch(env.MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'subscriber',
          name: name || 'ללא שם',
          email,
          phone: '—',
          topic: 'הרשמה לניוזלטר',
          message: 'נרשם/ה חדש/ה לרשימת התפוצה (ארגז הכלים) מהאתר.',
          country: request.headers.get('cf-ipcountry') || '',
          ts: new Date().toISOString(),
        }),
      });
    } catch (_) { /* notification failure shouldn't block signup */ }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// Returns full subscribers list from MailerLite, in-app.
export async function onRequestGet({ request, env }) {
  if (!env.MAILERLITE_TOKEN || !env.MAILERLITE_GROUP_ID) {
    return new Response(JSON.stringify({ error: 'MAILERLITE not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
  const url = new URL(request.url);
  const limit = url.searchParams.get('limit') || '50';
  const cursor = url.searchParams.get('cursor') || '';
  const q = new URLSearchParams({
    'filter[group]': env.MAILERLITE_GROUP_ID,
    limit,
  });
  if (cursor) q.set('cursor', cursor);
  try {
    const res = await fetch(`https://connect.mailerlite.com/api/subscribers?${q}`, {
      headers: { 'Authorization': `Bearer ${env.MAILERLITE_TOKEN}`, 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`MailerLite ${res.status}`);
    const data = await res.json();
    const subscribers = (data.data || []).map(s => ({
      id: s.id,
      email: s.email,
      name: s.fields?.name || '',
      status: s.status,
      subscribed_at: s.subscribed_at,
      ip: s.ip_address,
    }));
    return new Response(JSON.stringify({
      subscribers,
      total: data.total || subscribers.length,
      cursor: data.meta?.next_cursor || null,
    }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

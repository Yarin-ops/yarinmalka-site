// Returns the welcome customer-journey status from MailerLite:
// the welcome automation (active/steps) + group subscriber count.
export async function onRequestGet({ env }) {
  if (!env.MAILERLITE_TOKEN) {
    return json({ error: 'MAILERLITE not configured' }, 500);
  }
  const H = { 'Authorization': `Bearer ${env.MAILERLITE_TOKEN}`, 'Accept': 'application/json' };
  try {
    // automations list (find the welcome one)
    const aRes = await fetch('https://connect.mailerlite.com/api/automations', { headers: H });
    const aData = aRes.ok ? await aRes.json() : { data: [] };
    const autos = (aData.data || []).map(a => ({
      id: a.id,
      name: a.name,
      enabled: !!a.enabled,
      emails: a.emails_count || 0,
      complete: !!a.complete,
      subscribers_completed: a.stats?.completed_subscribers_count ?? 0,
      in_queue: a.stats?.subscribers_in_queue_count ?? 0,
      sent: a.stats?.sent ?? 0,
      open_rate: a.stats?.open_rate?.string ?? null,
    }));
    const welcome = autos.find(a => /welcome|yarinmalka/i.test(a.name)) || autos[0] || null;

    // subscriber total in the site group
    let subscribers = null;
    if (env.MAILERLITE_GROUP_ID) {
      const sRes = await fetch(`https://connect.mailerlite.com/api/subscribers?filter[group]=${env.MAILERLITE_GROUP_ID}&limit=1`, { headers: H });
      if (sRes.ok) { const sd = await sRes.json(); subscribers = sd.total ?? null; }
    }

    return json({ welcome, automations: autos, subscribers });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}

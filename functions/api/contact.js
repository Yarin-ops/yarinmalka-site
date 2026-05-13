// Public contact form endpoint - stores inquiry + fires notification webhook.
import { readJson, writeJson, json, errorResponse } from './admin/_store.js';

const FILE_PATH = 'assets/data/inquiries.json';
const MAX_MSG = 4000;
const MAX_FIELD = 200;

function clean(s, max) {
  return String(s || '').trim().substring(0, max);
}

export async function onRequestPost({ request, env }) {
  if (!env.GITHUB_TOKEN) {
    return errorResponse('service unavailable');
  }
  try {
    const data = await request.json();

    // Honeypot - bots that fill all fields get a fake success
    if (data.website) return json({ ok: true });

    const name = clean(data.name, MAX_FIELD);
    const email = clean(data.email, MAX_FIELD);
    const phone = clean(data.phone, MAX_FIELD);
    const topic = clean(data.topic, MAX_FIELD);
    const message = clean(data.message, MAX_MSG);

    if (!name || !email || !message) {
      return errorResponse('missing required fields', 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse('invalid email', 400);
    }

    const inquiry = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      name, email, phone, topic, message,
      status: 'new',
      country: request.headers.get('cf-ipcountry') || '',
    };

    const { content, sha } = await readJson(env, FILE_PATH);
    const list = content.inquiries || [];
    list.unshift(inquiry);
    await writeJson(env, FILE_PATH, { inquiries: list.slice(0, 500) }, sha, `New inquiry from ${name}`);

    // Fire notification webhook (non-blocking)
    if (env.MAKE_WEBHOOK_URL) {
      try {
        await fetch(env.MAKE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name, email,
            phone: phone || '—',
            topic: topic || 'כללי',
            message,
            country: inquiry.country,
            ts: inquiry.ts,
          }),
        });
      } catch (_) { /* notification failure shouldn't block submission */ }
    }

    return json({ ok: true, id: inquiry.id });
  } catch (e) {
    return errorResponse(e.message);
  }
}

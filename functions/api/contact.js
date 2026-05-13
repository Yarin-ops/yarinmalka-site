// Public contact form endpoint - stores inquiry in GitHub JSON file.
const OWNER = 'Yarin-ops';
const REPO = 'yarinmalka-site';
const FILE_PATH = 'assets/data/inquiries.json';
const BRANCH = 'main';
const MAX_MSG = 4000;
const MAX_FIELD = 200;

function ghHeaders(env) {
  return {
    'authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'accept': 'application/vnd.github+json',
    'user-agent': 'yarinmalka-contact',
  };
}

async function getFile(env) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`, { headers: ghHeaders(env) });
  if (!res.ok) throw new Error(`GET failed: ${res.status}`);
  const data = await res.json();
  const binary = atob(data.content.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { content: JSON.parse(new TextDecoder('utf-8').decode(bytes)), sha: data.sha };
}

async function putFile(env, newContent, sha, message) {
  const json = JSON.stringify(newContent, null, 2);
  const utf8 = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < utf8.length; i++) binary += String.fromCharCode(utf8[i]);
  const b64 = btoa(binary);
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
    method: 'PUT',
    headers: { ...ghHeaders(env), 'content-type': 'application/json' },
    body: JSON.stringify({ message, content: b64, sha, branch: BRANCH, committer: { name: 'Yarin Site', email: 'office@yarinmalka.co.il' } }),
  });
  if (!res.ok) throw new Error(`PUT failed: ${res.status}`);
  return res.json();
}

function clean(s, max) {
  return String(s || '').trim().substring(0, max);
}

export async function onRequestPost({ request, env }) {
  if (!env.GITHUB_TOKEN) {
    return new Response(JSON.stringify({ error: 'service unavailable' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  try {
    const data = await request.json();
    // Honeypot check
    if (data.website) {
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
    }
    const name = clean(data.name, MAX_FIELD);
    const email = clean(data.email, MAX_FIELD);
    const phone = clean(data.phone, MAX_FIELD);
    const topic = clean(data.topic, MAX_FIELD);
    const message = clean(data.message, MAX_MSG);

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: 'missing required fields' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'invalid email' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }

    const ipCountry = request.headers.get('cf-ipcountry') || '';
    const inquiry = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      name, email, phone, topic, message,
      status: 'new',
      country: ipCountry,
    };

    const { content, sha } = await getFile(env);
    const list = content.inquiries || [];
    list.unshift(inquiry);
    // Keep last 500 to avoid file getting huge
    const trimmed = list.slice(0, 500);
    await putFile(env, { inquiries: trimmed }, sha, `New inquiry from ${name}`);

    return new Response(JSON.stringify({ ok: true, id: inquiry.id }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

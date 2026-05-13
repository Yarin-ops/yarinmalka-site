const OWNER = 'Yarin-ops';
const REPO = 'yarinmalka-site';
const FILE_PATH = 'assets/data/inquiries.json';
const BRANCH = 'main';

function ghHeaders(env) {
  return {
    'authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'accept': 'application/vnd.github+json',
    'user-agent': 'yarinmalka-admin',
  };
}

async function getFile(env) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`, { headers: ghHeaders(env) });
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
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
    body: JSON.stringify({ message, content: b64, sha, branch: BRANCH, committer: { name: 'Yarin Admin', email: 'yarinmalka7@gmail.com' } }),
  });
  if (!res.ok) throw new Error(`GitHub PUT failed: ${res.status}`);
  return res.json();
}

export async function onRequestGet({ env }) {
  try {
    const { content } = await getFile(env);
    const list = content.inquiries || [];
    return new Response(JSON.stringify({
      inquiries: list,
      total: list.length,
      newCount: list.filter(i => i.status === 'new').length,
    }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const { id, status, deleteId } = await request.json();
    const { content, sha } = await getFile(env);
    let list = content.inquiries || [];
    if (deleteId) {
      list = list.filter(i => i.id !== deleteId);
    } else if (id && status) {
      list = list.map(i => i.id === id ? { ...i, status } : i);
    } else {
      return new Response(JSON.stringify({ error: 'missing id+status or deleteId' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }
    await putFile(env, { inquiries: list }, sha, deleteId ? `Delete inquiry ${deleteId.substring(0,8)}` : `Mark inquiry ${id.substring(0,8)} as ${status}`);
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

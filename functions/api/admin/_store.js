// Shared GitHub storage helpers for admin CRUD endpoints.
const OWNER = 'Yarin-ops';
const REPO = 'yarinmalka-site';
const BRANCH = 'main';
const COMMITTER = { name: 'Yarin Admin', email: 'yarinmalka7@gmail.com' };

function ghHeaders(env) {
  return {
    'authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'accept': 'application/vnd.github+json',
    'user-agent': 'yarinmalka-admin',
  };
}

export async function readJson(env, path) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,
    { headers: ghHeaders(env) }
  );
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status}`);
  const data = await res.json();
  const binary = atob(data.content.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return {
    content: JSON.parse(new TextDecoder('utf-8').decode(bytes)),
    sha: data.sha,
  };
}

export async function writeJson(env, path, newContent, sha, message) {
  const json = JSON.stringify(newContent, null, 2);
  const utf8 = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < utf8.length; i++) binary += String.fromCharCode(utf8[i]);
  const b64 = btoa(binary);
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: { ...ghHeaders(env), 'content-type': 'application/json' },
      body: JSON.stringify({
        message,
        content: b64,
        sha,
        branch: BRANCH,
        committer: COMMITTER,
      }),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub PUT ${path}: ${res.status} ${t.substring(0, 200)}`);
  }
  return res.json();
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function errorResponse(message, status = 500) {
  return json({ error: message }, status);
}

// Build a standard CRUD handler for a collection endpoint
// (GET returns { [key]: [...] }, PUT replaces with { [key]: body[key] })
export function makeCrud({ filePath, key, validate }) {
  return {
    async onRequestGet({ env }) {
      try {
        const { content, sha } = await readJson(env, filePath);
        return json({ [key]: content[key] || [], sha });
      } catch (e) {
        return errorResponse(e.message);
      }
    },
    async onRequestPut({ request, env }) {
      try {
        const body = await request.json();
        const items = body[key];
        if (!Array.isArray(items)) {
          return errorResponse(`${key} must be an array`, 400);
        }
        if (validate) {
          for (let i = 0; i < items.length; i++) {
            const err = validate(items[i]);
            if (err) return errorResponse(`item ${i}: ${err}`, 400);
          }
        }
        const { sha } = await readJson(env, filePath);
        await writeJson(env, filePath, { [key]: items }, sha,
          body.message || `Update ${key} via admin`);
        return json({ ok: true });
      } catch (e) {
        return errorResponse(e.message);
      }
    },
  };
}

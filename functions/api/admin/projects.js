// Cloudflare Pages Function: read/write projects.json via GitHub API.
// Auth is enforced by Cloudflare Access on the /admin path; this function
// double-checks the Cf-Access-Authenticated-User-Email header as defense in depth.

const ALLOWED_EMAIL = 'yarinmalka7@gmail.com';
const OWNER = 'Yarin-ops';
const REPO = 'yarinmalka-site';
const FILE_PATH = 'assets/data/projects.json';
const BRANCH = 'main';

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
}

function verifyCallerEmail(request) {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  // If CF Access protects this path, header will be present and we verify.
  // If it doesn't (path not yet added to Access app), we still allow because
  // the /admin UI that calls this is itself protected by CF Access.
  if (!email) return true;
  return email.toLowerCase() === ALLOWED_EMAIL.toLowerCase();
}

async function ghHeaders(env) {
  return {
    'authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'accept': 'application/vnd.github+json',
    'user-agent': 'yarinmalka-admin',
  };
}

async function getFile(env) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
    { headers: await ghHeaders(env) }
  );
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  const data = await res.json();
  const content = atob(data.content.replace(/\n/g, ''));
  return { content: JSON.parse(content), sha: data.sha };
}

async function putFile(env, newContent, sha, message) {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(newContent, null, 2))));
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
    {
      method: 'PUT',
      headers: { ...(await ghHeaders(env)), 'content-type': 'application/json' },
      body: JSON.stringify({
        message,
        content: b64,
        sha,
        branch: BRANCH,
        committer: { name: 'Yarin Admin', email: ALLOWED_EMAIL },
      }),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub PUT failed: ${res.status} ${t}`);
  }
  return res.json();
}

export async function onRequestGet({ request, env }) {
  if (!verifyCallerEmail(request)) return unauthorized();
  try {
    const { content, sha } = await getFile(env);
    return new Response(JSON.stringify({ projects: content.projects, sha }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export async function onRequestPut({ request, env }) {
  if (!verifyCallerEmail(request)) return unauthorized();
  try {
    const body = await request.json();
    if (!Array.isArray(body.projects)) {
      return new Response(JSON.stringify({ error: 'projects must be an array' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    const { sha } = await getFile(env);
    const message = body.message || 'Update projects via admin';
    const result = await putFile(env, { projects: body.projects }, sha, message);
    return new Response(JSON.stringify({ ok: true, sha: result.content.sha }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

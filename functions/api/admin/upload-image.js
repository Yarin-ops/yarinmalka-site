// Image upload to GitHub assets/uploads/.
// Accepts multipart form-data with `file` field, returns the relative path.
const OWNER = 'Yarin-ops';
const REPO = 'yarinmalka-site';
const BRANCH = 'main';
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

function ghHeaders(env) {
  return {
    'authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'accept': 'application/vnd.github+json',
    'user-agent': 'yarinmalka-admin',
  };
}

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').toLowerCase();
}

function ts() {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}-${String(d.getUTCHours()).padStart(2,'0')}${String(d.getUTCMinutes()).padStart(2,'0')}${String(d.getUTCSeconds()).padStart(2,'0')}`;
}

export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const folder = form.get('folder') || 'uploads';
    if (!file || typeof file === 'string') {
      return new Response(JSON.stringify({ error: 'no file' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return new Response(JSON.stringify({ error: 'file too large (max 8MB)' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }
    const cleanName = sanitize(file.name || 'image.jpg');
    const filename = `${ts()}-${cleanName}`;
    const path = `assets/${folder}/${filename}`;

    // base64 encode
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);

    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
      {
        method: 'PUT',
        headers: { ...ghHeaders(env), 'content-type': 'application/json' },
        body: JSON.stringify({
          message: `Upload image: ${filename}`,
          content: b64,
          branch: BRANCH,
          committer: { name: 'Yarin Admin', email: 'yarinmalka7@gmail.com' },
        }),
      }
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`GitHub PUT failed: ${res.status} ${t.substring(0, 200)}`);
    }
    return new Response(JSON.stringify({
      ok: true,
      path,
      url: `/${path}`,
    }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
}

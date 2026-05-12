// Cookie-based auth middleware for all /api/admin/* endpoints.
// Login endpoint is exempt (it sets the cookie).

const COOKIE_NAME = 'yma_session';

async function hmacSha256(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const bytes = new Uint8Array(sig);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

export async function verifyToken(token, secret) {
  if (!token || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expected = await hmacSha256(secret, payloadB64);
  if (sig !== expected) return false;
  try {
    const payload = JSON.parse(atob(payloadB64));
    if (!payload.exp || payload.exp < Date.now()) return false;
    return payload;
  } catch (_) { return false; }
}

export async function signToken(payload, secret) {
  const payloadB64 = btoa(JSON.stringify(payload));
  const sig = await hmacSha256(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

const ALLOWED_EMAIL = 'yarinmalka7@gmail.com';

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  // Login endpoint sets the cookie - don't gate it
  if (url.pathname === '/api/admin/login' || url.pathname === '/api/admin/logout') {
    return next();
  }

  // Path 1: Cloudflare Access header (if CF Access is still configured)
  const cfEmail = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (cfEmail && cfEmail.toLowerCase() === ALLOWED_EMAIL) {
    return next();
  }

  // Path 2: Our own cookie session
  if (env.ADMIN_SECRET) {
    const cookie = request.headers.get('cookie') || '';
    const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (match) {
      const valid = await verifyToken(match[1], env.ADMIN_SECRET);
      if (valid) return next();
    }
  }

  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401, headers: { 'content-type': 'application/json' },
  });
}

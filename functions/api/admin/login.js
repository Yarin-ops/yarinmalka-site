import { signToken } from './_middleware.js';

const COOKIE_NAME = 'yma_session';
const ONE_DAY_MS = 86400000;

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: 'ADMIN_PASSWORD or ADMIN_SECRET not configured' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
  try {
    const { password } = await request.json();
    if (!password || password !== env.ADMIN_PASSWORD) {
      // small delay to slow down brute force
      await new Promise(r => setTimeout(r, 800));
      return new Response(JSON.stringify({ error: 'סיסמה שגויה' }), {
        status: 401, headers: { 'content-type': 'application/json' },
      });
    }
    const token = await signToken({ exp: Date.now() + ONE_DAY_MS }, env.ADMIN_SECRET);
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'content-type': 'application/json',
        'set-cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ONE_DAY_MS / 1000}`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

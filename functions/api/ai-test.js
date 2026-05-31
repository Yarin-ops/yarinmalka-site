// TEMP diagnostic endpoint: /api/ai-test  — bare-minimum Gemini call to isolate the 502.
export async function onRequestGet(context) {
  const { env } = context;
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

  if (!env.GEMINI_API_KEY) return J({ step: 'key', ok: false, msg: 'no GEMINI_API_KEY' });
  const keyInfo = { len: env.GEMINI_API_KEY.length, prefix: env.GEMINI_API_KEY.slice(0, 4) };

  const MODEL = env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Say hi in Hebrew, one word.' }] }] }),
    });
    const txt = await r.text();
    return J({ step: 'fetch', ok: r.ok, status: r.status, keyInfo, model: MODEL, body: txt.slice(0, 600) });
  } catch (e) {
    return J({ step: 'catch', ok: false, keyInfo, model: MODEL, err: String(e && e.message || e) });
  }
}

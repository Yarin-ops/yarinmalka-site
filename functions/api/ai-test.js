// TEMP diagnostic endpoint: /api/ai-test  — bare-minimum Gemini call to isolate the 502.
export async function onRequestGet(context) {
  const { env } = context;
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

  if (!env.GEMINI_API_KEY) return J({ step: 'key', ok: false, msg: 'no GEMINI_API_KEY' });
  const keyInfo = { len: env.GEMINI_API_KEY.length, prefix: env.GEMINI_API_KEY.slice(0, 4) };

  // List available models for this key (also validates the key)
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(env.GEMINI_API_KEY)}`);
    const txt = await r.text();
    let models = null;
    try {
      const d = JSON.parse(txt);
      if (d.models) models = d.models.filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', ''));
    } catch {}
    return J({ step: 'listModels', keyOk: r.ok, status: r.status, keyInfo, models: models || txt.slice(0, 400) });
  } catch (e) {
    return J({ step: 'catch', ok: false, keyInfo, err: String(e && e.message || e) });
  }
}

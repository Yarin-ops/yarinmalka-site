// POST /api/ai-analysis — personalized AI automation ideas via Google Gemini (free tier).
// Body: { business: string, tasks?: string[] }
// Returns: { ok: true, recommendations: [{title, body}, ...] }
// Degrades gracefully to a friendly message if GEMINI_API_KEY is not set.

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  };
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: cors });

  // ---- parse + validate ----
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, message: 'invalid_json' }, 400); }

  const business = String(body.business || '').trim().slice(0, 600);
  const tasks = Array.isArray(body.tasks) ? body.tasks.slice(0, 12).map(t => String(t).slice(0, 40)) : [];
  if (business.length < 15) return json({ ok: false, message: 'כתוב קצת יותר על העסק שלך.' }, 400);

  // ---- graceful no-key path ----
  const KEY = env.GEMINI_API_KEY;
  if (!KEY) {
    return json({
      ok: false,
      message: 'הניתוח האישי מ-AI עוד לא הופעל באתר הזה. בינתיים המחשבון נותן תמונה מלאה - ולניתוח אישי אמיתי, ',
    }, 503);
  }

  const MODEL = env.GEMINI_MODEL || 'gemini-flash-latest';
  const sys = `אתה יועץ AI מעשי לעסקים קטנים בישראל, מטעם ירין מלכה.
המשתמש מתאר את העסק שלו. החזר בדיוק 3 רעיונות קונקרטיים לאוטומציה עם AI שמתאימים בדיוק לעסק שלו.
לכל רעיון: כותרת קצרה (עד 6 מילים) וגוף של 1-2 משפטים שמסביר מה לעשות ואיזה כלי.
עברית פשוטה, ישירה, בלי הייפ, בלי אימוג'י. אל תבטיח מספרים מדויקים.`;
  const user = `העסק: ${business}\n${tasks.length ? 'משימות שסומנו: ' + tasks.join(', ') : ''}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(KEY)}`;
  const payload = {
    system_instruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      maxOutputTokens: 700,
      temperature: 0.7,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          recommendations: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { title: { type: 'STRING' }, body: { type: 'STRING' } },
              required: ['title', 'body'],
            },
          },
        },
        required: ['recommendations'],
      },
    },
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      return json({ ok: false, message: 'שירות ה-AI עמוס כרגע. נסה שוב בעוד רגע, או ' }, 502);
    }
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let recs = [];
    try {
      const parsed = JSON.parse(text);
      recs = (parsed.recommendations || []).slice(0, 3);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { recs = (JSON.parse(m[0]).recommendations || []).slice(0, 3); } catch {} }
    }
    if (!recs.length) return json({ ok: false, message: 'לא הצלחתי לנתח כרגע. נסה שוב, או ' }, 502);
    recs = recs.map(r => ({
      title: String(r.title || '').slice(0, 80),
      body: String(r.body || '').slice(0, 320),
    }));
    return json({ ok: true, recommendations: recs });
  } catch (e) {
    return json({ ok: false, message: 'שגיאה זמנית. נסה שוב, או ' }, 500);
  }
}

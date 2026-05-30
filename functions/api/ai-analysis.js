// POST /api/ai-analysis — personalized AI automation ideas via Claude (Haiku).
// Body: { business: string, tasks?: string[] }
// Returns: { ok: true, recommendations: [{title, body}, ...] }
// Degrades gracefully to a friendly message if ANTHROPIC_API_KEY is not set.

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
  if (!env.ANTHROPIC_API_KEY) {
    return json({
      ok: false,
      message: 'הניתוח האישי מ-AI עוד לא הופעל באתר הזה. בינתיים המחשבון נותן תמונה מלאה - ולניתוח אישי אמיתי, ',
    }, 503);
  }

  // ---- lightweight abuse guard: cap output, cheap model ----
  const MODEL = env.AI_MODEL || 'claude-3-5-haiku-20241022';
  const sys = `אתה יועץ AI מעשי לעסקים קטנים בישראל, מטעם ירין מלכה.
המשתמש מתאר את העסק שלו. החזר בדיוק 3 רעיונות קונקרטיים לאוטומציה עם AI שמתאימים בדיוק לעסק שלו.
לכל רעיון: כותרת קצרה (עד 6 מילים) וגוף של 1-2 משפטים שמסביר מה לעשות ואיזה כלי.
עברית פשוטה, ישירה, בלי הייפ, בלי אימוג'י. אל תבטיח מספרים מדויקים.
החזר אך ורק JSON תקין במבנה: {"recommendations":[{"title":"...","body":"..."},{...},{...}]}`;
  const user = `העסק: ${business}\n${tasks.length ? 'משימות שסומנו: ' + tasks.join(', ') : ''}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: sys,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!resp.ok) {
      return json({ ok: false, message: 'שירות ה-AI עמוס כרגע. נסה שוב בעוד רגע, או ' }, 502);
    }
    const data = await resp.json();
    let text = (data.content && data.content[0] && data.content[0].text) || '';
    // extract JSON object from the model output
    const m = text.match(/\{[\s\S]*\}/);
    let recs = [];
    if (m) {
      try { recs = (JSON.parse(m[0]).recommendations || []).slice(0, 3); } catch { /* fall through */ }
    }
    if (!recs.length) return json({ ok: false, message: 'לא הצלחתי לנתח כרגע. נסה שוב, או ' }, 502);
    // sanitize
    recs = recs.map(r => ({
      title: String(r.title || '').slice(0, 80),
      body: String(r.body || '').slice(0, 320),
    }));
    return json({ ok: true, recommendations: recs });
  } catch (e) {
    return json({ ok: false, message: 'שגיאה זמנית. נסה שוב, או ' }, 500);
  }
}

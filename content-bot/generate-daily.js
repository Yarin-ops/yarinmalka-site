#!/usr/bin/env node
/**
 * Daily content autopilot for yarinmalka.co.il.
 * Picks the next idea from backlog.md (rotating pillars), and via Gemini
 * generates a SUBSTANTIAL post in Yarin's voice (excellent Hebrew, real value),
 * plus social versions and an image search query. Fetches a relevant REAL photo
 * from Unsplash. Then:
 *   - prepends the post to assets/data/tips.json (auto-publishes to /tips)
 *   - saves social versions to content-bot/output/<date>.md
 *   - marks the idea done in backlog.md
 * Run by GitHub Actions on a daily cron. Env: GEMINI_API_KEY, UNSPLASH_ACCESS_KEY.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BOT = __dirname;
const VOICE = fs.readFileSync(path.join(BOT, 'voice.md'), 'utf8');
const BACKLOG_PATH = path.join(BOT, 'backlog.md');
const TIPS_PATH = path.join(ROOT, 'assets', 'data', 'tips.json');
const OUT_DIR = path.join(BOT, 'output');

const PILLARS = ['כלי השבוע', 'AI לעסק', 'האמת על...', 'טיפ מהיר', 'מאחורי הקלעים'];
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const KEY = process.env.GEMINI_API_KEY;
const UNSPLASH = process.env.UNSPLASH_ACCESS_KEY;

const today = () => new Date().toISOString().slice(0, 10);

function pickIdea(backlog, lastPillar) {
  const lines = backlog.split('\n');
  const byPillar = {}; let cur = null;
  lines.forEach((ln, i) => {
    const h = ln.match(/^##\s*פילר\s*\d+\s*-\s*(.+?)\s*$/);
    if (h) { cur = h[1].trim(); byPillar[cur] = byPillar[cur] || []; return; }
    if (cur && /^\s*-\s*⬜/.test(ln)) byPillar[cur].push({ i, text: ln.replace(/^\s*-\s*⬜\s*/, '').trim() });
  });
  const start = PILLARS.indexOf(lastPillar);
  const order = [];
  for (let k = 1; k <= PILLARS.length; k++) order.push(PILLARS[(start + k + PILLARS.length) % PILLARS.length]);
  for (const p of order) if (byPillar[p] && byPillar[p].length) return { pillar: p, ...byPillar[p][0] };
  for (const p of PILLARS) if (byPillar[p] && byPillar[p].length) return { pillar: p, ...byPillar[p][0] };
  return null;
}
function markDone(backlog, i) {
  const lines = backlog.split('\n');
  lines[i] = lines[i].replace('⬜', `✅ (${today()})`);
  return lines.join('\n');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function gemini(prompt) {
  // try the main model with retries, then fall back to flash-lite (less loaded)
  const models = [MODEL, 'gemini-2.5-flash-lite'];
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(KEY)}`;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2000, temperature: 0.85 } }) });
      if (r.ok) return (await r.json())?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const status = r.status;
      const body = (await r.text()).slice(0, 200);
      // retry on transient overload / rate limit
      if ((status === 503 || status === 429 || status >= 500) && attempt < 4) {
        console.log(`  ${model} ${status} (attempt ${attempt}) - retrying...`);
        await sleep(attempt * 4000);
        continue;
      }
      console.log(`  ${model} failed: ${status} ${body}`);
      break; // move to fallback model
    }
  }
  throw new Error('Gemini unavailable after retries + fallback');
}
function parseJson(t) { try { return JSON.parse(t); } catch {} const m = t.match(/\{[\s\S]*\}/); if (m) try { return JSON.parse(m[0]); } catch {} return null; }

async function unsplashImage(query) {
  if (!UNSPLASH) return null;
  try {
    const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${UNSPLASH}` } });
    if (!r.ok) return null;
    const d = await r.json();
    const p = d.results && d.results[0];
    if (!p) return null;
    return { url: p.urls.regular, alt: p.alt_description || query, credit: p.user.name, creditUrl: p.user.links.html };
  } catch { return null; }
}

(async () => {
  if (!KEY) { console.error('Missing GEMINI_API_KEY'); process.exit(1); }
  const tips = JSON.parse(fs.readFileSync(TIPS_PATH, 'utf8'));
  const lastPillar = tips.tips?.[0]?.pillar || null;
  let backlog = fs.readFileSync(BACKLOG_PATH, 'utf8');
  const idea = pickIdea(backlog, lastPillar);
  if (!idea) { console.error('No open ideas. Add more to backlog.'); process.exit(1); }
  console.log(`Pillar: ${idea.pillar} | Idea: ${idea.text}`);

  const prompt = `${VOICE}

---
אתה ירין מלכה, כותב פוסט אמיתי לאתר שלך. כתוב לפי הקול שלמעלה.

הנושא (פילר "${idea.pillar}"): ${idea.text}

חוקי איכות (חובה):
- עברית מצוינת, טבעית וזורמת. בלי תרגומית, בלי שגיאות, בלי ניסוחים מלאכותיים של AI.
- תוכן אמיתי ומהותי - לא קלישאות. תן ערך שאפשר ליישם, דוגמה קונקרטית, מספר/פרט אמיתי.
- אורך הגוף: 220-320 מילים. פסקאות קצרות. מבנה: hook → ערך אמיתי → מה לעשות עם זה.
- בלי קו מפריד (—), בלי "לסיכום", בלי אימוג'י בגוף הפוסט באתר.

החזר אך ורק JSON תקין במבנה הזה (בלי markdown):
{
  "title": "כותרת חדה ומסקרנת לפוסט (עד 9 מילים)",
  "body": "גוף הפוסט לאתר, 220-320 מילים, עברית מעולה, מהותי. פסקאות מופרדות ב-\\n\\n",
  "image_query": "2-4 English words describing a clean, relevant real photo for this post (e.g. 'person working laptop office')",
  "status": "וואטסאפ Status: hook ב-*כוכביות*, 3-5 שורות ערך עם נקודות, CTA רך. שורות ב-\\n",
  "linkedin": "פוסט לינקדאין: hook, רווחים (\\n\\n), ערך, שאלה לקהל, 3 hashtags",
  "instagram": "כיתוב אינסטגרם: hook+ערך+CTA, ואז 6 hashtags"
}`;

  const c = parseJson(await gemini(prompt));
  if (!c || !c.title || !c.body || c.body.length < 200) throw new Error('Output too weak/short: ' + JSON.stringify(c).slice(0, 300));

  const img = await unsplashImage(c.image_query || idea.text);

  tips.tips.unshift({
    date: today(), pillar: idea.pillar,
    title: String(c.title).slice(0, 140),
    body: String(c.body).slice(0, 2500),
    image: img ? img.url : null,
    imageAlt: img ? img.alt : null,
    credit: img ? img.credit : null,
    creditUrl: img ? img.creditUrl : null,
  });
  fs.writeFileSync(TIPS_PATH, JSON.stringify(tips, null, 2) + '\n');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${today()}-daily.md`),
    `# ${today()} · ${idea.pillar}\n## ${c.title}\n\n### וואטסאפ Status\n\`\`\`\n${c.status || ''}\n\`\`\`\n\n### לינקדאין\n\`\`\`\n${c.linkedin || ''}\n\`\`\`\n\n### אינסטגרם\n\`\`\`\n${c.instagram || ''}\n\`\`\`\n\nתמונה: ${img ? img.url + ' (by ' + img.credit + ')' : 'לא נמצאה'}\n`);

  fs.writeFileSync(BACKLOG_PATH, markDone(backlog, idea.i));
  console.log(`Done. Published "${c.title}" to /tips${img ? ' with image' : ' (no image)'}.`);
})().catch(e => { console.error(e.message); process.exit(1); });

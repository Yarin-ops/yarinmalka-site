#!/usr/bin/env node
/**
 * Daily content autopilot for yarinmalka.co.il.
 * Picks the next idea from backlog.md (rotating pillars), generates a short
 * site tip + social versions in Yarin's voice via Gemini, then:
 *   - prepends the tip to site assets/data/tips.json (auto-publishes to /tips)
 *   - saves social versions to content-bot/output/<date>.md (for manual posting)
 *   - marks the idea done in backlog.md
 * Run by GitHub Actions on a daily cron. Needs env GEMINI_API_KEY.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');           // site/
const BOT = __dirname;                                  // site/content-bot/
const VOICE = fs.readFileSync(path.join(BOT, 'voice.md'), 'utf8');
const BACKLOG_PATH = path.join(BOT, 'backlog.md');
const TIPS_PATH = path.join(ROOT, 'assets', 'data', 'tips.json');
const OUT_DIR = path.join(BOT, 'output');

const PILLARS = ['כלי השבוע', 'AI לעסק', 'האמת על...', 'טיפ מהיר', 'מאחורי הקלעים'];
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const KEY = process.env.GEMINI_API_KEY;

function today() { return new Date().toISOString().slice(0, 10); }

// --- pick the next idea (rotate pillars based on last published tip) ---
function pickIdea(backlog, lastPillar) {
  const lines = backlog.split('\n');
  // map: pillar name -> [{lineIndex, text}]
  const byPillar = {};
  let cur = null;
  lines.forEach((ln, i) => {
    const h = ln.match(/^##\s*פילר\s*\d+\s*-\s*(.+?)\s*$/);
    if (h) { cur = h[1].trim(); byPillar[cur] = byPillar[cur] || []; return; }
    if (cur && /^\s*-\s*⬜/.test(ln)) {
      byPillar[cur].push({ i, text: ln.replace(/^\s*-\s*⬜\s*/, '').trim() });
    }
  });
  // rotation order starting after lastPillar
  let start = PILLARS.indexOf(lastPillar);
  const order = [];
  for (let k = 1; k <= PILLARS.length; k++) order.push(PILLARS[(start + k) % PILLARS.length]);
  for (const p of order) { if (byPillar[p] && byPillar[p].length) return { pillar: p, ...byPillar[p][0] }; }
  // fallback: any open idea
  for (const p of PILLARS) { if (byPillar[p] && byPillar[p].length) return { pillar: p, ...byPillar[p][0] }; }
  return null;
}

function markDone(backlog, lineIndex) {
  const lines = backlog.split('\n');
  lines[lineIndex] = lines[lineIndex].replace('⬜', `✅ (${today()})`);
  return lines.join('\n');
}

async function gemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(KEY)}`;
  const r = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1200, temperature: 0.8 } }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

(async () => {
  if (!KEY) { console.error('Missing GEMINI_API_KEY'); process.exit(1); }

  const tips = JSON.parse(fs.readFileSync(TIPS_PATH, 'utf8'));
  const lastPillar = tips.tips && tips.tips[0] ? tips.tips[0].pillar : null;
  let backlog = fs.readFileSync(BACKLOG_PATH, 'utf8');

  const idea = pickIdea(backlog, lastPillar);
  if (!idea) { console.error('No open ideas in backlog. Add more.'); process.exit(1); }
  console.log(`Pillar: ${idea.pillar} | Idea: ${idea.text}`);

  const prompt = `${VOICE}

---
אתה ירין מלכה. כתוב תוכן לפי הקול שלמעלה - בלי הייפ, ישיר, פרקטי, עברית, בלי קו מפריד (—).

הנושא להיום (פילר "${idea.pillar}"): ${idea.text}

צור 4 גרסאות לאותו רעיון והחזר אך ורק JSON תקין במבנה הזה, בלי טקסט נוסף ובלי markdown:
{
  "title": "כותרת קצרה לטיפ באתר (עד 8 מילים)",
  "body": "פסקה אחת קצרה לאתר (2-3 משפטים, מעשי, בלי אימוג'י)",
  "status": "פוסט לוואטסאפ Status: hook מודגש עם *כוכביות*, 3-5 שורות ערך עם נקודות, ו-CTA רך. שורות מופרדות ב-\\n",
  "linkedin": "פוסט לינקדאין: hook, רווחים בין שורות (\\n\\n), ערך קצר, שאלה לקהל בסוף, 3 hashtags",
  "instagram": "כיתוב אינסטגרם: hook+ערך+CTA, ואז 6 hashtags",
  "visual": "תיאור קצר באנגלית של ויזואל מתאים לפוסט"
}`;

  const raw = await gemini(prompt);
  const c = parseJson(raw);
  if (!c || !c.title || !c.body) throw new Error('Bad model output: ' + raw.slice(0, 300));

  // 1) prepend tip to site feed
  tips.tips.unshift({ date: today(), pillar: idea.pillar, title: String(c.title).slice(0, 120), body: String(c.body).slice(0, 600) });
  fs.writeFileSync(TIPS_PATH, JSON.stringify(tips, null, 2) + '\n');

  // 2) save social versions for manual posting
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const social = `# ${today()} · ${idea.pillar}\n## ${c.title}\n\n### וואטסאפ Status\n\`\`\`\n${c.status || ''}\n\`\`\`\n\n### לינקדאין\n\`\`\`\n${c.linkedin || ''}\n\`\`\`\n\n### אינסטגרם\n\`\`\`\n${c.instagram || ''}\n\`\`\`\n\nויזואל מוצע: ${c.visual || ''}\n`;
  fs.writeFileSync(path.join(OUT_DIR, `${today()}-daily.md`), social);

  // 3) mark idea done
  fs.writeFileSync(BACKLOG_PATH, markDone(backlog, idea.i));

  console.log('Done. Tip published to /tips, social saved to output/.');
})().catch(e => { console.error(e.message); process.exit(1); });

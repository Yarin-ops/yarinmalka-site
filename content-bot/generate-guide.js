#!/usr/bin/env node
/**
 * Weekly guide autopilot for yarinmalka.co.il.
 * Picks the next idea from backlog.md (rotating pillars), generates a FULL
 * guide in Yarin's voice via Gemini, builds it into a real guide page (same
 * design as all guides), gives it a pillar cover image, and adds the framed
 * card to /guides. Also saves social versions. Run weekly by GitHub Actions.
 * Env: GEMINI_API_KEY.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');          // site/ (repo root)
const BOT = __dirname;
const VOICE = fs.readFileSync(path.join(BOT, 'voice.md'), 'utf8');
const BACKLOG_PATH = path.join(BOT, 'backlog.md');
const GUIDES_HTML = path.join(REPO, 'guides.html');
const SITEMAP = path.join(REPO, 'sitemap.xml');
const OUT_DIR = path.join(BOT, 'output');
const BUILD = path.join(BOT, 'build', 'build-guide.js');

const PILLARS = ['כלי השבוע', 'AI לעסק', 'האמת על...', 'טיפ מהיר', 'מאחורי הקלעים'];
const PILLAR_COVER = {
  'כלי השבוע': 'pillar-tools.jpg',
  'AI לעסק': 'financial-agent-truth.jpg',
  'האמת על...': 'what-is-ai.jpg',
  'טיפ מהיר': 'make.jpg',
  'מאחורי הקלעים': '3-ai-families.jpg',
};
const THEMES = ['theme-blue', 'theme-purple', 'theme-green', 'theme-pink'];
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const KEY = process.env.GEMINI_API_KEY;
const today = () => new Date().toISOString().slice(0, 10);
const todayHe = () => { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function pickIdea(backlog, lastPillar) {
  const lines = backlog.split('\n'); const byP = {}; let cur = null;
  lines.forEach((ln, i) => {
    const h = ln.match(/^##\s*פילר\s*\d+\s*-\s*(.+?)\s*$/);
    if (h) { cur = h[1].trim(); byP[cur] = byP[cur] || []; return; }
    if (cur && /^\s*-\s*⬜/.test(ln)) byP[cur].push({ i, text: ln.replace(/^\s*-\s*⬜\s*/, '').trim() });
  });
  const s = PILLARS.indexOf(lastPillar); const order = [];
  for (let k = 1; k <= PILLARS.length; k++) order.push(PILLARS[(s + k + PILLARS.length) % PILLARS.length]);
  for (const p of order) if (byP[p] && byP[p].length) return { pillar: p, ...byP[p][0] };
  for (const p of PILLARS) if (byP[p] && byP[p].length) return { pillar: p, ...byP[p][0] };
  return null;
}
async function gemini(prompt) {
  const models = [MODEL, 'gemini-2.5-flash'];
  let raw = '';
  for (const model of models) for (let a = 1; a <= 4; a++) {
    let r; try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(KEY)}`,
        { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 5000, temperature: 0.85, thinkingConfig: { thinkingBudget: 0 } } }) });
    } catch { await sleep(a * 4000); continue; }
    if (r.ok) { raw = (await r.json())?.candidates?.[0]?.content?.parts?.[0]?.text || ''; if (raw.includes('{')) return raw; await sleep(a * 3000); continue; }
    if ((r.status >= 500 || r.status === 429) && a < 4) { console.log(`  ${model} ${r.status} retry ${a}`); await sleep(a * 4000); continue; }
    console.log(`  ${model} ${r.status}`); break;
  }
  throw new Error('Gemini unavailable. raw: ' + raw.slice(0, 200));
}
function parseJson(t) { t = String(t || '').replace(/```json/gi, '').replace(/```/g, '').trim(); try { return JSON.parse(t); } catch {} const m = t.match(/\{[\s\S]*\}/); if (m) try { return JSON.parse(m[0]); } catch {} return null; }
const q = s => '"' + String(s || '').replace(/"/g, '').replace(/\n/g, ' ').trim() + '"';
function slugify(s) { return String(s || 'guide').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'guide'; }

(async () => {
  if (!KEY) { console.error('Missing GEMINI_API_KEY'); process.exit(1); }
  let backlog = fs.readFileSync(BACKLOG_PATH, 'utf8');
  // last pillar = the most recent auto-marked done
  const doneLines = backlog.split('\n').filter(l => /✅/.test(l));
  const lastPillar = null; // simple rotation from first open
  const idea = pickIdea(backlog, lastPillar);
  if (!idea) { console.error('No open ideas.'); process.exit(1); }
  console.log(`Pillar: ${idea.pillar} | Idea: ${idea.text}`);

  const prompt = `${VOICE}

---
אתה ירין מלכה, כותב מדריך מלא ואיכותי לאתר שלך. כתוב לפי הקול שלמעלה.

הנושא (פילר "${idea.pillar}"): ${idea.text}

חוקי איכות (חובה):
- עברית מצוינת, טבעית. בלי תרגומית, בלי שגיאות, בלי ניסוחי AI מלאכותיים.
- מדריך אמיתי ומהותי, 600-850 מילים, עם ערך מעשי, דוגמאות קונקרטיות.
- מבנה: פתיח קצר, ואז 3-4 כותרות משנה (##) עם תוכן מתחת לכל אחת.
- בלי קו מפריד (—), בלי "לסיכום", בלי אימוג'י.

החזר אך ורק JSON תקין (בלי markdown), במבנה:
{
  "title": "כותרת מלאה למדריך (עד 11 מילים)",
  "h1_main": "החלק הראשון של הכותרת הגדולה",
  "h1_accent": "המילה/ביטוי האחרון שיודגש בסגול",
  "slug": "english-url-slug-with-hyphens",
  "description": "תיאור 1-2 משפטים לכרטיס ולמטא",
  "breadcrumb": "AI · קטגוריה קצרה",
  "lead": "פסקת הובלה, 2-3 שורות, מה המדריך נותן ולמי",
  "body": "גוף המדריך ב-markdown: פסקת פתיח, ואז ## כותרת\\nתוכן\\n\\n## כותרת\\nתוכן... 600-850 מילים",
  "status": "פוסט וואטסאפ Status עם *כוכביות* ו-CTA",
  "linkedin": "פוסט לינקדאין עם רווחים ושאלה בסוף",
  "instagram": "כיתוב אינסטגרם + 6 hashtags"
}`;

  const c = parseJson(await gemini(prompt));
  if (!c || !c.title || !c.body || c.body.length < 400) throw new Error('Weak output: ' + JSON.stringify(c).slice(0, 200));

  const slug = slugify(c.slug || c.title) + '-' + today().replace(/-/g, '').slice(4); // unique-ish
  const guideCount = fs.readdirSync(path.join(REPO, 'guides')).filter(f => f.endsWith('.html')).length;
  const number = String(guideCount + 1).padStart(2, '0');
  const words = c.body.split(/\s+/).length;
  const readMin = Math.max(4, Math.round(words / 200));
  const cover = PILLAR_COVER[idea.pillar] || 'what-is-ai.jpg';

  // build the markdown
  const md = `---
title: ${q(c.title)}
description: ${q(c.description)}
slug: "${slug}"
date: "${today()}"
date_display: "${todayHe()}"
reading_time: "${readMin} דקות קריאה"
number: "${number}"
category: "AI"
breadcrumb: ${q(c.breadcrumb || 'AI')}
h1_main: ${q(c.h1_main || c.title)}
h1_accent: ${q(c.h1_accent || '')}
lead: ${q(c.lead || c.description)}
---

${c.body}
`;
  const tmpMd = path.join(OUT_DIR, `${slug}.md`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(tmpMd, md);

  // build the guide HTML into guides/<slug>.html
  execFileSync('node', [BUILD, tmpMd, '--out', path.join(REPO, 'guides', `${slug}.html`)], { stdio: 'inherit' });

  // insert the framed card into guides.html grid (newest first)
  const theme = THEMES[guideCount % THEMES.length];
  const card = `    <a href="/guides/${slug}" data-cat="ai" class="guide-card ${theme} reveal" style="text-decoration:none;color:inherit">
        <div class="card-art card-art-framed"><img src="/assets/guide-covers/${cover}" alt="${String(c.title).replace(/"/g,'')}" loading="lazy"></div>
        <span class="guide-card-tag">${c.breadcrumb || 'AI'}</span>
        <h3>${String(c.title).replace(/</g,'')}</h3>
        <p>${String(c.description).replace(/</g,'')}</p>
        <div class="footer-meta">
            <span>${todayHe()}</span>
            <span>${readMin} דקות קריאה</span>
        </div>
    </a>
`;
  let gh = fs.readFileSync(GUIDES_HTML, 'utf8');
  gh = gh.replace('<div class="guide-grid" id="guideGrid">\n', '<div class="guide-grid" id="guideGrid">\n' + card);
  fs.writeFileSync(GUIDES_HTML, gh);

  // sitemap
  let sm = fs.readFileSync(SITEMAP, 'utf8');
  if (!sm.includes(`/guides/${slug}<`)) {
    const entry = `  <url>\n    <loc>https://yarinmalka.co.il/guides/${slug}</loc>\n    <lastmod>${today()}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    sm = sm.replace('</urlset>', entry + '</urlset>');
    fs.writeFileSync(SITEMAP, sm);
  }

  // social + mark done
  fs.writeFileSync(path.join(OUT_DIR, `${today()}-${slug}.md`),
    `# ${todayHe()} · ${idea.pillar} · ${c.title}\nמדריך: /guides/${slug}\n\n### Status\n\`\`\`\n${c.status||''}\n\`\`\`\n\n### לינקדאין\n\`\`\`\n${c.linkedin||''}\n\`\`\`\n\n### אינסטגרם\n\`\`\`\n${c.instagram||''}\n\`\`\`\n`);
  const lines = backlog.split('\n'); lines[idea.i] = lines[idea.i].replace('⬜', `✅ (${today()})`);
  fs.writeFileSync(BACKLOG_PATH, lines.join('\n'));
  // remove the temp md
  try { fs.unlinkSync(tmpMd); } catch {}

  console.log(`Done. Guide "${c.title}" -> /guides/${slug} with cover ${cover}.`);
})().catch(e => { console.error(e.message); process.exit(1); });

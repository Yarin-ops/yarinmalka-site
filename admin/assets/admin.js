const state = { projects: [], editingId: null, stats: null };

function toast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' err' : '');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function navigate(view) {
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  document.querySelectorAll('.nav-item[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const el = document.getElementById('view-' + view);
  if (el) el.style.display = 'block';
  if (view === 'projects') loadProjects();
  if (view === 'guides') loadGuides();
  if (view === 'subscribers') loadSubscribers();
  if (view === 'journey') loadJourney();
  if (view === 'testimonials') loadTestimonials();
  if (view === 'analytics') loadAnalytics();
  if (view === 'workshops') loadWorkshops();
  if (view === 'faq') loadFaqs();
  if (view === 'services') loadServices();
  if (view === 'settings') loadSettings();
  if (view === 'inquiries') loadInquiries();
  if (view === 'system') loadSystem();
}
document.querySelectorAll('.nav-item[data-view]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.view)));

async function loadMe() {
  try {
    const r = await fetch('/api/admin/me');
    const d = await r.json();
    document.getElementById('userEmail').textContent = d.email || 'לא ידוע';
  } catch (e) {
    document.getElementById('userEmail').textContent = '—';
  }
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days === 0) {
    const hours = Math.floor((Date.now() - d) / 3600000);
    if (hours === 0) return 'לפני דקות';
    return `לפני ${hours} שעות`;
  }
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

async function loadDashboard() {
  const btn = document.getElementById('refreshBtn');
  if (btn) btn.disabled = true;

  // greeting + date
  const h = new Date().getHours();
  const greet = h < 12 ? 'בוקר טוב, ירין' : h < 18 ? 'צהריים טובים, ירין' : 'ערב טוב, ירין';
  set('dashGreeting', greet);
  set('dashDate', new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }));

  // fire all in parallel; none blocks the others
  const [stats, inq, analytics] = await Promise.allSettled([
    fetch('/api/admin/stats').then(r => r.ok ? r.json() : Promise.reject('HTTP ' + r.status)),
    fetch('/api/admin/inquiries').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('/api/admin/analytics?days=7').then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  // stats
  if (stats.status === 'fulfilled') {
    const d = stats.value; state.stats = d;
    set('statTotal', d.projects?.total ?? '—');
    set('statTotalSub', (d.projects?.featured ?? 0) + ' מוצגים בבית');
    set('statFeatured', d.projects?.featured ?? '—');
    set('statGuides', d.guides?.total ?? '—');
    set('statSubs', d.subscribers?.total ?? '—');
    set('navCountProjects', d.projects?.total ?? '—');
    set('navCountGuides', d.guides?.total ?? '—');
    set('navCountSubs', d.subscribers?.total ?? '—');
    set('subsTotal', d.subscribers?.total ?? '—');
  } else {
    toast('שגיאה בטעינת נתונים', true);
  }

  // inquiries → stat + attention card
  const inqData = inq.status === 'fulfilled' ? inq.value : null;
  const items = (inqData && inqData.inquiries) || [];
  const newItems = items.filter(x => x.status === 'new');
  const newCount = (inqData && inqData.newCount != null) ? inqData.newCount : newItems.length;
  set('statInquiries', newCount);
  set('navCountInq', newCount);
  const card = document.getElementById('cardInquiries');
  if (card) card.classList.toggle('alert', newCount > 0);
  set('statInquiriesSub', newCount > 0 ? 'ממתינות לתשובה' : 'הכל מטופל');
  renderAttention(newItems);

  // analytics → visitors stat + mini chart
  const a = analytics.status === 'fulfilled' ? analytics.value : null;
  renderDashTraffic(a);

  if (btn) btn.disabled = false;
}

function renderAttention(newItems) {
  const card = document.getElementById('attentionCard');
  const list = document.getElementById('attentionList');
  if (!card || !list) return;
  if (!newItems.length) { card.style.display = 'none'; return; }
  card.style.display = '';
  list.innerHTML = newItems.slice(0, 4).map(x => `
    <div class="att-item" onclick="navigate('inquiries')">
      <div class="att-avatar">${escapeHtml((x.name || '?').trim().charAt(0))}</div>
      <div class="att-body">
        <div class="att-top"><strong>${escapeHtml(x.name || 'ללא שם')}</strong><span class="att-time">${x.ts ? fmtDate(x.ts) : ''}</span></div>
        <div class="att-msg">${escapeHtml((x.message || x.subject || '').slice(0, 90))}</div>
      </div>
      <svg class="att-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
    </div>
  `).join('');
}

function renderDashTraffic(a) {
  const box = document.getElementById('dashTraffic');
  if (!box) return;
  if (!a || a.error || !a.byDay) {
    set('statVisitors', '—');
    set('statVisitorsSub', 'אנליטיקס לא מחובר');
    box.innerHTML = `<div class="empty" style="padding:20px 12px"><p style="line-height:1.7">אנליטיקס עדיין לא מחובר.<br><a onclick="navigate('analytics')" style="color:var(--accent-light);cursor:pointer">הגדר עכשיו →</a></p></div>`;
    return;
  }
  set('statVisitors', (a.pageViews || 0).toLocaleString());
  set('statVisitorsSub', (a.visits || 0).toLocaleString() + ' ביקורים');
  const byDay = a.byDay || [];
  const max = Math.max(1, ...byDay.map(b => b.count || 0));
  box.innerHTML = `
    <div class="mini-bars">
      ${byDay.map(b => {
        const pct = Math.round(((b.count || 0) / max) * 100);
        const lbl = b.date ? new Date(b.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) : '';
        return `<div class="mini-bar-col"><div class="mini-bar-track"><div class="mini-bar-fill" style="height:${Math.max(4, pct)}%"><span class="mini-bar-val">${b.count || 0}</span></div></div><span class="mini-bar-lbl">${lbl}</span></div>`;
      }).join('')}
    </div>`;
}

async function loadStatsOnly() {
  if (!state.stats) await loadDashboard();
}

// The planned 4-email welcome sequence (source of truth for the visual).
const WELCOME_SEQUENCE = [
  { n: 0, title: 'מייל ברוכים הבאים', sub: 'מי אני ולמה אני כאן', delay: 'מיידי', theme: 'purple' },
  { n: 1, title: 'הסיפור של AI', sub: 'איך הגענו לכאן', delay: 'אחרי יומיים', theme: 'blue' },
  { n: 2, title: 'שלוש משפחות של AI', sub: 'איזה AI לאיזו משימה', delay: 'אחרי 5 ימים', theme: 'green' },
  { n: 3, title: 'חמישה כלי AI חינמיים', sub: 'שווים זהב', delay: 'אחרי 8 ימים', theme: 'pink' },
];

async function loadJourney() {
  const box = document.getElementById('journeyContent');
  box.innerHTML = '<div class="empty" style="padding:40px"><div class="loading"></div></div>';
  let j = null;
  try {
    const r = await fetch('/api/admin/journey');
    if (r.ok) j = await r.json();
  } catch (e) {}

  const w = j && j.welcome;
  const liveCount = w ? (w.emails || 0) : 0;
  const active = w ? w.enabled : false;
  const subs = j && j.subscribers != null ? j.subscribers : '—';

  const statusBadge = active
    ? '<span class="jr-status on"><span class="dot-live"></span>פעיל</span>'
    : '<span class="jr-status off">מושהה</span>';

  const stats = w ? `
    <div class="jr-stats">
      <div class="jr-stat"><div class="jr-stat-val">${subs}</div><div class="jr-stat-lbl">מנויים ברשימה</div></div>
      <div class="jr-stat"><div class="jr-stat-val">${w.sent ?? 0}</div><div class="jr-stat-lbl">מיילים שנשלחו</div></div>
      <div class="jr-stat"><div class="jr-stat-val">${w.subscribers_completed ?? 0}</div><div class="jr-stat-lbl">השלימו את המסע</div></div>
      <div class="jr-stat"><div class="jr-stat-val">${w.open_rate ?? '—'}</div><div class="jr-stat-lbl">שיעור פתיחה</div></div>
    </div>` : '';

  const steps = WELCOME_SEQUENCE.map((s, i) => {
    const isLive = i < liveCount;
    const statusTxt = isLive ? 'חי במסע' : 'מוכן · טיוטה';
    const statusCls = isLive ? 'live' : 'draft';
    return `
      ${i > 0 ? `<div class="jr-delay">${s.delay}</div>` : ''}
      <div class="jr-step ${statusCls}">
        <div class="jr-step-icon theme-${s.theme}">
          ${isLive
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>'}
        </div>
        <div class="jr-step-body">
          <div class="jr-step-top"><strong>${escapeHtml(s.title)}</strong><span class="jr-tag ${statusCls}">${statusTxt}</span></div>
          <div class="jr-step-sub">${escapeHtml(s.sub)} · ${s.delay}</div>
        </div>
      </div>`;
  }).join('');

  const draftsLeft = WELCOME_SEQUENCE.length - liveCount;
  const note = draftsLeft > 0
    ? `<div class="jr-note"><strong>${draftsLeft} מיילים מוכנים להוספה.</strong> הם כתובים ושמורים כטיוטות ב-MailerLite. כדי להוסיף למסע: בעורך האוטומציה לחץ "+", גרור Send email, ובחר את הטיוטה המתאימה.</div>`
    : `<div class="jr-note ok">כל המסע מחובר ופעיל. כל נרשם חדש מקבל את הרצף המלא אוטומטית.</div>`;

  box.innerHTML = `
    <div class="card jr-head">
      <div class="jr-head-row">
        <div>
          <div class="jr-head-title">רצף ברוכים הבאים ${statusBadge}</div>
          <div class="jr-head-sub">מופעל כשמישהו נרשם לרשימת yarinmalka.co.il</div>
        </div>
        <div class="jr-live-count"><span>${liveCount}</span>/${WELCOME_SEQUENCE.length} מיילים חיים</div>
      </div>
      ${stats}
    </div>

    <div class="card" style="margin-top:16px">
      <div class="jr-flow">
        <div class="jr-trigger">
          <div class="jr-step-icon" style="background:rgba(245,158,11,0.16);color:#fcd34d"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6M19 8v6"/></svg></div>
          <div class="jr-step-body"><div class="jr-step-top"><strong>נרשם חדש</strong></div><div class="jr-step-sub">מצטרף לרשימת התפוצה</div></div>
        </div>
        ${steps}
      </div>
      ${note}
    </div>`;
}

async function loadProjects() {
  try {
    const r = await fetch('/api/admin/projects');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    state.projects = d.projects || [];
    renderProjects();
  } catch (e) {
    document.getElementById('projectList').innerHTML = '<div class="empty"><h3>שגיאה בטעינה</h3><p>' + e.message + '</p></div>';
  }
}

function renderProjects() {
  const list = document.getElementById('projectList');
  if (state.projects.length === 0) {
    list.innerHTML = '<div class="empty"><div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16M3 21h18"/></svg></div><h3>אין פרויקטים עדיין</h3><p>לחץ "פרויקט חדש" כדי להתחיל</p></div>';
    return;
  }
  list.innerHTML = state.projects.map(p => `
    <div class="proj-row">
      <img src="/${p.image || 'assets/og-image.png'}" alt="">
      <div class="proj-info">
        <h3>${escapeHtml(p.title)}</h3>
        <div><span class="badge">${escapeHtml(p.badge || '')}</span>${p.featured ? '<span class="badge feat">Featured</span>' : ''}<span class="meta">${p.year || ''}</span></div>
        <p>${escapeHtml(p.description || '')}</p>
      </div>
      <button class="btn btn-s btn-icon" onclick="openProject('${p.id}')" aria-label="ערוך">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>
  `).join('');
}

async function loadGuides() {
  const list = document.getElementById('guidesList');
  list.innerHTML = '<div class="empty"><div class="loading"></div></div>';
  const GUIDES = [
    { slug: 'claude-excel', title: 'Claude in Excel', date: '2026-05-04' },
    { slug: '5-free-ai-tools', title: '5 כלי AI חינמיים', date: '2026-05-05' },
    { slug: 'what-is-ai', title: 'מה זה AI', date: '2026-05-07' },
    { slug: '3-ai-families', title: '3 משפחות AI', date: '2026-05-07' },
    { slug: 'financial-agent-truth', title: 'יועצי AI פיננסיים', date: '2026-05-07' },
    { slug: 'make-ai-automation', title: 'אוטומציות Make + AI', date: '2026-05-08' },
    { slug: 'notion-ai-hebrew', title: 'Notion AI בעברית', date: '2026-05-08' },
  ];
  list.innerHTML = GUIDES.map(g => `
    <div class="proj-row" style="grid-template-columns: 1fr auto auto">
      <div class="proj-info">
        <h3>${g.title}</h3>
        <p class="meta">פורסם ${fmtDate(g.date)} · /guides/${g.slug}</p>
      </div>
      <a href="/guides/${g.slug}" target="_blank"><button class="btn btn-s btn-icon">צפה ↗</button></a>
      <a href="https://github.com/Yarin-ops/yarinmalka-site/blob/main/guides/${g.slug}.html" target="_blank"><button class="btn btn-s btn-icon">ערוך ↗</button></a>
    </div>
  `).join('');
}

function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function openProject(id) {
  const form = document.getElementById('projForm');
  form.reset();
  state.editingId = id || null;
  document.getElementById('modalTitle').textContent = id ? 'עריכת פרויקט' : 'פרויקט חדש';
  document.getElementById('deleteBtn').style.display = id ? 'inline-flex' : 'none';
  document.querySelector('[name="id"]').readOnly = !!id;
  if (id) {
    const p = state.projects.find(x => x.id === id);
    if (p) {
      Object.entries(p).forEach(([k, v]) => {
        const el = form.elements[k];
        if (!el) return;
        if (el.type === 'checkbox') el.checked = !!v;
        else el.value = v;
      });
    }
  }
  document.getElementById('modalBg').classList.add('open');
}

function closeModal() {
  document.getElementById('modalBg').classList.remove('open');
  state.editingId = null;
}

document.getElementById('modalBg').addEventListener('click', (e) => {
  if (e.target.id === 'modalBg') closeModal();
});

document.getElementById('projForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span> שומר...';
  try {
    const fd = new FormData(e.target);
    const data = {};
    fd.forEach((v, k) => { data[k] = v; });
    data.featured = !!e.target.featured.checked;
    if (data.year) data.year = data.year.toString();

    let newProjects;
    if (state.editingId) {
      newProjects = state.projects.map(p => p.id === state.editingId ? { ...p, ...data } : p);
    } else {
      if (state.projects.find(p => p.id === data.id)) throw new Error('מזהה כבר קיים');
      newProjects = [...state.projects, data];
    }

    const r = await fetch('/api/admin/projects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projects: newProjects, message: state.editingId ? `Update project: ${data.id}` : `Add project: ${data.id}` }),
    });
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.error || 'שגיאה');
    }
    state.projects = newProjects;
    renderProjects();
    closeModal();
    toast('נשמר! האתר יעדכן תוך 30 שניות');
    loadDashboard();
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'שמור';
  }
});

async function deleteProj() {
  if (!state.editingId) return;
  if (!confirm('למחוק את הפרויקט הזה?')) return;
  const btn = document.getElementById('deleteBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span>';
  try {
    const newProjects = state.projects.filter(p => p.id !== state.editingId);
    const r = await fetch('/api/admin/projects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projects: newProjects, message: `Delete project: ${state.editingId}` }),
    });
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.error || 'שגיאה');
    }
    state.projects = newProjects;
    renderProjects();
    closeModal();
    toast('הפרויקט נמחק');
    loadDashboard();
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'מחק';
  }
}

// === SUBSCRIBERS ===
state.subscribers = [];

async function loadSubscribers() {
  try {
    const r = await fetch('/api/admin/subscribers?limit=100');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    state.subscribers = d.subscribers || [];
    document.getElementById('subsTotal').textContent = d.total ?? state.subscribers.length;
    document.getElementById('subsActive').textContent = state.subscribers.filter(s => s.status === 'active').length;
    const weekAgo = Date.now() - 7*86400000;
    document.getElementById('subsWeek').textContent = state.subscribers.filter(s => new Date(s.subscribed_at).getTime() > weekAgo).length;
    renderSubscribers();
  } catch (e) {
    document.getElementById('subsList').innerHTML = '<div class="empty"><h3>שגיאה בטעינה</h3><p>' + e.message + '</p></div>';
  }
}

function renderSubscribers() {
  const list = document.getElementById('subsList');
  if (!state.subscribers.length) {
    list.innerHTML = '<div class="empty"><div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div><h3>אין מנויים עדיין</h3></div>';
    return;
  }
  list.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr auto auto;gap:14px;padding:8px 12px;font-size:11px;font-family:Inter;color:var(--text3);text-transform:uppercase;letter-spacing:0.08em;font-weight:600;border-bottom:1px solid var(--glass-border);">' +
    '<div>אימייל</div><div>שם</div><div>סטטוס</div><div>תאריך</div></div>' +
    state.subscribers.map(s => `
      <div class="proj-row" style="grid-template-columns:1fr 1fr auto auto;padding:10px 12px;">
        <div style="font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;direction:ltr;text-align:right;">${escapeHtml(s.email)}</div>
        <div style="font-size:13px;color:var(--text2);">${escapeHtml(s.name || '—')}</div>
        <div><span class="badge" style="${s.status === 'active' ? 'background:rgba(16,185,129,0.12);border-color:rgba(16,185,129,0.3);color:#6ee7b7' : ''}">${s.status}</span></div>
        <div style="font-size:11px;color:var(--text3);font-family:Inter;">${fmtDate(s.subscribed_at)}</div>
      </div>
    `).join('');
}

function downloadCsv() {
  if (!state.subscribers.length) return;
  const rows = [['email','name','status','subscribed_at']];
  state.subscribers.forEach(s => rows.push([s.email, s.name || '', s.status, s.subscribed_at]));
  const csv = rows.map(r => r.map(c => `"${(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(["﻿" + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `subscribers-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV הורד');
}

// === TESTIMONIALS ===
state.testimonials = [];
state.editingTestiId = null;

async function loadTestimonials() {
  try {
    const r = await fetch('/api/admin/testimonials');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    state.testimonials = d.testimonials || [];
    document.getElementById('navCountTesti').textContent = state.testimonials.length;
    renderTestimonials();
  } catch (e) {
    document.getElementById('testiList').innerHTML = '<div class="empty"><h3>שגיאה</h3><p>' + e.message + '</p></div>';
  }
}

function renderTestimonials() {
  const list = document.getElementById('testiList');
  if (!state.testimonials.length) {
    list.innerHTML = '<div class="empty"><h3>אין המלצות</h3></div>';
    return;
  }
  list.innerHTML = state.testimonials.map(t => `
    <div class="proj-row" style="grid-template-columns:48px 1fr auto;">
      <img src="/${t.avatar}" alt="" style="width:48px;height:48px;border-radius:50%;">
      <div class="proj-info">
        <h3>${escapeHtml(t.name)}</h3>
        <div class="meta">${escapeHtml(t.role || '')} · ⭐${t.rating || 5}</div>
        <p style="margin-top:6px;">"${escapeHtml((t.quote || '').substring(0, 140))}${(t.quote || '').length > 140 ? '...' : ''}"</p>
      </div>
      <button class="btn btn-s btn-icon" onclick="openTesti('${t.id}')" aria-label="ערוך">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>
  `).join('');
}

function openTesti(id) {
  state.editingTestiId = id || null;
  const t = id ? state.testimonials.find(x => x.id === id) : { id: '', name: '', role: '', avatar: '', link: '', rating: 5, quote: '' };
  if (!t) return;
  const html = `
    <div class="modal-bg open" id="testiModalBg" onclick="if(event.target.id==='testiModalBg')closeTestiModal()">
      <div class="modal">
        <h2>${id ? 'עריכת המלצה' : 'המלצה חדשה'}</h2>
        <form id="testiForm">
          <div class="field"><label>מזהה</label><input name="id" required pattern="[a-z0-9-]+" value="${escapeHtml(t.id)}" ${id?'readonly':''}></div>
          <div class="field-row">
            <div class="field"><label>שם</label><input name="name" required value="${escapeHtml(t.name)}"></div>
            <div class="field"><label>תפקיד/עסק</label><input name="role" value="${escapeHtml(t.role||'')}"></div>
          </div>
          <div class="field-row">
            <div class="field"><label>אווטר (נתיב)</label><input name="avatar" value="${escapeHtml(t.avatar||'')}" placeholder="assets/x-avatar.jpg"></div>
            <div class="field"><label>קישור (אופציונלי)</label><input name="link" value="${escapeHtml(t.link||'')}"></div>
          </div>
          <div class="field"><label>דירוג (1-5)</label><input name="rating" type="number" min="1" max="5" value="${t.rating||5}"></div>
          <div class="field"><label>ציטוט</label><textarea name="quote" required>${escapeHtml(t.quote||'')}</textarea></div>
          <div class="modal-actions">
            ${id ? '<button type="button" class="btn btn-d" onclick="deleteTesti()">מחק</button>' : ''}
            <div style="display:flex;gap:8px;margin-inline-start:auto;">
              <button type="button" class="btn btn-s" onclick="closeTestiModal()">ביטול</button>
              <button type="submit" class="btn btn-p" id="testiSaveBtn">שמור</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div.firstElementChild);
  document.getElementById('testiForm').addEventListener('submit', saveTesti);
}

function closeTestiModal() {
  const el = document.getElementById('testiModalBg');
  if (el) el.remove();
  state.editingTestiId = null;
}

async function saveTesti(e) {
  e.preventDefault();
  const btn = document.getElementById('testiSaveBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span>';
  try {
    const fd = new FormData(e.target);
    const data = { rating: 5 };
    fd.forEach((v, k) => { data[k] = k === 'rating' ? parseInt(v) : v; });
    let newTestis;
    if (state.editingTestiId) {
      newTestis = state.testimonials.map(t => t.id === state.editingTestiId ? { ...t, ...data } : t);
    } else {
      if (state.testimonials.find(t => t.id === data.id)) throw new Error('מזהה כבר קיים');
      newTestis = [...state.testimonials, data];
    }
    const r = await fetch('/api/admin/testimonials', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ testimonials: newTestis, message: state.editingTestiId ? `Update testimonial: ${data.id}` : `Add testimonial: ${data.id}` }),
    });
    if (!r.ok) { const er = await r.json(); throw new Error(er.error); }
    state.testimonials = newTestis;
    renderTestimonials();
    document.getElementById('navCountTesti').textContent = state.testimonials.length;
    closeTestiModal();
    toast('נשמר!');
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'שמור';
  }
}

async function deleteTesti() {
  if (!state.editingTestiId) return;
  if (!confirm('למחוק את ההמלצה?')) return;
  try {
    const newTestis = state.testimonials.filter(t => t.id !== state.editingTestiId);
    const r = await fetch('/api/admin/testimonials', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ testimonials: newTestis, message: `Delete testimonial: ${state.editingTestiId}` }),
    });
    if (!r.ok) { const er = await r.json(); throw new Error(er.error); }
    state.testimonials = newTestis;
    renderTestimonials();
    document.getElementById('navCountTesti').textContent = state.testimonials.length;
    closeTestiModal();
    toast('נמחק');
  } catch (e) { toast(e.message, true); }
}

// === ANALYTICS ===
async function loadAnalytics() {
  const days = document.getElementById('analyticsRange')?.value || '7';
  const content = document.getElementById('analyticsContent');
  content.innerHTML = '<div class="empty"><div class="loading"></div></div>';
  try {
    const r = await fetch('/api/admin/analytics?days=' + days);
    const d = await r.json();
    if (d.error) {
      content.innerHTML = `
        <div class="card">
          <div class="empty">
            <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
            <h3>אנליטיקס לא מוגדר עדיין</h3>
            <p style="max-width:420px;margin:8px auto 0;line-height:1.7;">
              צריך טוקן Cloudflare ייעודי עם הרשאת Analytics:Read. בוא לקלאודפלייר → My Profile → API Tokens → Create Token, בחר "Read all resources" או צור custom עם <code>Account:Analytics:Read</code>, ושמור כ-<code>CF_ANALYTICS_TOKEN</code> ב-Pages env vars.
            </p>
            <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank"><button class="btn btn-p" style="margin-top:14px;">פתח Cloudflare API Tokens ↗</button></a>
          </div>
        </div>`;
      return;
    }
    const byDay = d.byDay || [];
    const maxBar = Math.max(1, ...byDay.map(b => b.count || 0));
    const avgPerVisit = d.visits ? (d.pageViews / d.visits).toFixed(1) : '0';
    content.innerHTML = `
      <div style="font-size:12px;color:var(--text3);margin-bottom:12px;display:flex;align-items:center;gap:6px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Cloudflare Web Analytics · מעקב מבקרים אמיתיים בלבד (ללא בוטים)
      </div>
      <div class="stat-grid" style="margin-bottom:16px;">
        <div class="stat-card"><div class="stat-row"><div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div><div class="stat-info"><div class="stat-label">צפיות בעמודים</div><div class="stat-value">${d.pageViews.toLocaleString()}</div></div></div></div>
        <div class="stat-card blue"><div class="stat-row"><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div><div class="stat-info"><div class="stat-label">ביקורים</div><div class="stat-value">${d.visits.toLocaleString()}</div></div></div></div>
        <div class="stat-card green"><div class="stat-row"><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3zM3 9h18M9 21V9"/></svg></div><div class="stat-info"><div class="stat-label">דפים לביקור</div><div class="stat-value">${avgPerVisit}</div></div></div></div>
        <div class="stat-card pink"><div class="stat-row"><div class="stat-icon pink"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg></div><div class="stat-info"><div class="stat-label">ב-${days} ימים</div><div class="stat-value" style="font-size:16px;">${d.since}<br><small style="font-size:11px;color:var(--text3);font-weight:400;">עד ${d.until}</small></div></div></div></div>
      </div>
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><h2>צפיות יומיות</h2></div>
        <div style="display:flex;gap:5px;align-items:flex-end;height:140px;padding:8px 0;">
          ${byDay.map(b => {
            const pv = b.count || 0;
            const h = Math.max(4, (pv / maxBar) * 130);
            const date = b.dimensions?.date || '';
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;" title="${date}: ${pv} צפיות">
              <div style="font-size:10px;color:var(--text2);font-family:Inter;font-weight:500;">${pv}</div>
              <div style="width:100%;height:${h}px;background:linear-gradient(180deg,var(--accent-light),var(--accent));border-radius:4px 4px 0 0;"></div>
              <div style="font-size:9px;color:var(--text3);font-family:Inter;">${date.substring(5)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="grid-2">
        <div class="card"><div class="card-header"><h2>עמודים פופולריים</h2></div>${renderTopList(d.topPaths, 'requestPath', '/')}</div>
        <div class="card"><div class="card-header"><h2>מקורות תנועה</h2></div>${renderTopList(d.topReferers, 'refererHost', '—')}</div>
      </div>
      <div class="grid-2" style="margin-top:16px;">
        <div class="card"><div class="card-header"><h2>מדינות מובילות</h2></div>${renderTopList(d.topCountries, 'countryName', '—')}</div>
        <div class="card"><div class="card-header"><h2>סוג מכשיר</h2></div>${renderTopList(d.topDevices, 'deviceType', '—')}</div>
      </div>
    `;
  } catch (e) {
    content.innerHTML = '<div class="card"><div class="empty"><h3>שגיאה</h3><p>' + e.message + '</p></div></div>';
  }
}

function renderTopList(items, dimKey, fallback) {
  if (!items || !items.length) return '<div class="empty"><p>אין נתונים</p></div>';
  const max = Math.max(...items.map(i => i.count));
  return items.map(i => {
    const label = i.dimensions?.[dimKey] || fallback;
    const pct = (i.count / max) * 100;
    return `<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:75%;">${escapeHtml(label)}</span><span style="color:var(--text3);font-family:Inter;font-size:12px;">${i.count.toLocaleString()}</span></div><div style="height:5px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent-light),var(--accent));"></div></div></div>`;
  }).join('');
}

// === INQUIRIES ===
state.inquiries = [];

const INQ_TOPIC = { project: 'פרויקט', workshop: 'סדנה', finance: 'ייעוץ', general: 'כללי', '': 'לא צוין' };
const INQ_STATUS = { new: { label: 'חדש', color: '#10B981' }, read: { label: 'נקרא', color: '#a78bfa' }, replied: { label: 'נענה', color: '#7a7a88' } };

async function loadInquiries() {
  try {
    const r = await fetch('/api/admin/inquiries');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    state.inquiries = d.inquiries || [];
    document.getElementById('navCountInq').textContent = d.newCount || 0;
    renderInquiries();
  } catch (e) {
    document.getElementById('inqList').innerHTML = '<div class="empty"><h3>שגיאה</h3><p>' + e.message + '</p></div>';
  }
}

function renderInquiries() {
  const list = document.getElementById('inqList');
  if (!state.inquiries.length) {
    list.innerHTML = '<div class="empty"><div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><h3>אין פניות עדיין</h3><p>כשמישהו ימלא את הטופס באתר, זה יופיע כאן</p></div>';
    return;
  }
  list.innerHTML = state.inquiries.map(i => {
    const status = INQ_STATUS[i.status] || INQ_STATUS.new;
    return `
    <div style="padding:14px;border-radius:12px;border:1px solid var(--glass-border);margin-bottom:8px;background:${i.status==='new'?'rgba(16,185,129,0.04)':'transparent'};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px;">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text);">${escapeHtml(i.name)}</div>
          <div style="font-size:12px;color:var(--text3);direction:ltr;text-align:right;margin-top:2px;">${escapeHtml(i.email)}${i.phone ? ' · ' + escapeHtml(i.phone) : ''}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span class="badge" style="background:${status.color}22;border-color:${status.color}55;color:${status.color};">${status.label}</span>
          <span class="badge">${INQ_TOPIC[i.topic] || i.topic}</span>
        </div>
      </div>
      <div style="font-size:14px;color:var(--text);line-height:1.7;white-space:pre-wrap;margin-bottom:10px;">${escapeHtml(i.message)}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding-top:10px;border-top:1px solid var(--glass-border);">
        <div style="font-size:11px;color:var(--text3);font-family:Inter;">${fmtDate(i.ts)}${i.country ? ' · ' + i.country : ''}</div>
        <div style="display:flex;gap:6px;">
          <a href="mailto:${escapeHtml(i.email)}" class="btn btn-s btn-icon" title="השב במייל"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></a>
          ${i.phone ? `<a href="https://wa.me/${encodeURIComponent(i.phone.replace(/\\D/g, ''))}" target="_blank" class="btn btn-s btn-icon" title="WhatsApp"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606"/></svg></a>` : ''}
          ${i.status !== 'replied' ? `<button class="btn btn-s btn-icon" onclick="markInquiry('${i.id}','replied')" title="סמן כנענה"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>` : ''}
          <button class="btn btn-d btn-icon" onclick="delInquiry('${i.id}')" title="מחק"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function markInquiry(id, status) {
  try {
    const r = await fetch('/api/admin/inquiries', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status }) });
    if (!r.ok) throw new Error('failed');
    state.inquiries = state.inquiries.map(i => i.id === id ? { ...i, status } : i);
    renderInquiries();
    toast('עודכן');
  } catch (e) { toast(e.message, true); }
}

async function delInquiry(id) {
  if (!confirm('למחוק את הפנייה?')) return;
  try {
    const r = await fetch('/api/admin/inquiries', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deleteId: id }) });
    if (!r.ok) throw new Error('failed');
    state.inquiries = state.inquiries.filter(i => i.id !== id);
    renderInquiries();
    toast('נמחק');
  } catch (e) { toast(e.message, true); }
}

// === SETTINGS ===
state.settings = null;

async function loadSettings() {
  try {
    const r = await fetch('/api/admin/settings');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    state.settings = d.settings || {};
    renderSettingsForm();
  } catch (e) {
    document.getElementById('settingsContent').innerHTML = '<div class="empty"><h3>שגיאה</h3><p>' + e.message + '</p></div>';
  }
}

function renderSettingsForm() {
  const s = state.settings || {};
  const c = s.contact || {};
  const soc = s.social || {};
  const br = s.branding || {};
  document.getElementById('settingsContent').innerHTML = `
    <div class="card" style="margin-bottom:14px;">
      <div class="card-header"><h2>פרטי קשר</h2></div>
      <div class="field-row">
        <div class="field"><label>טלפון (תצוגה)</label><input data-setting="contact.phone" value="${escapeHtml(c.phone || '')}" placeholder="053-680-5136"></div>
        <div class="field"><label>טלפון (בינלאומי)</label><input data-setting="contact.phone_intl" value="${escapeHtml(c.phone_intl || '')}" placeholder="972536805136"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>אימייל</label><input data-setting="contact.email" type="email" value="${escapeHtml(c.email || '')}"></div>
        <div class="field"><label>WhatsApp (בינלאומי)</label><input data-setting="contact.whatsapp" value="${escapeHtml(c.whatsapp || '')}" placeholder="972536805136"></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px;">
      <div class="card-header"><h2>רשתות חברתיות</h2></div>
      <div class="field"><label>LinkedIn</label><input data-setting="social.linkedin" type="url" value="${escapeHtml(soc.linkedin || '')}"></div>
      <div class="field"><label>X / Twitter</label><input data-setting="social.twitter" type="url" value="${escapeHtml(soc.twitter || '')}"></div>
      <div class="field"><label>Instagram</label><input data-setting="social.instagram" type="url" value="${escapeHtml(soc.instagram || '')}"></div>
      <div class="field"><label>Facebook</label><input data-setting="social.facebook" type="url" value="${escapeHtml(soc.facebook || '')}"></div>
    </div>

    <div class="card">
      <div class="card-header"><h2>מותג</h2></div>
      <div class="field"><label>טאגליין</label><input data-setting="branding.tagline" value="${escapeHtml(br.tagline || '')}" placeholder="AI · TECH · TOOLS"></div>
      <div class="field"><label>תיאור קצר (פוטר)</label><textarea data-setting="branding.blurb" rows="3">${escapeHtml(br.blurb || '')}</textarea></div>
    </div>
  `;
}

async function saveSettings() {
  const btn = document.getElementById('settingsSaveBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span> שומר...';
  try {
    const newSettings = {};
    document.querySelectorAll('[data-setting]').forEach(el => {
      const path = el.getAttribute('data-setting').split('.');
      let cur = newSettings;
      for (let i = 0; i < path.length - 1; i++) {
        if (!cur[path[i]]) cur[path[i]] = {};
        cur = cur[path[i]];
      }
      cur[path[path.length - 1]] = el.value;
    });
    const r = await fetch('/api/admin/settings', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ settings: newSettings, message: 'Update site settings via admin' }),
    });
    if (!r.ok) { const er = await r.json(); throw new Error(er.error); }
    state.settings = newSettings;
    toast('הגדרות נשמרו!');
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8"/></svg> שמור שינויים';
  }
}

// === SERVICES ===
state.services = [];
state.editingServiceId = null;
const SVC_COLORS = ['web','fin','aca'];
const SVC_ICON_OPTS = ['web','finance','academy'];

async function loadServices() {
  try {
    const r = await fetch('/api/admin/services');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    state.services = d.services || [];
    document.getElementById('navCountServices').textContent = state.services.length;
    renderServices();
  } catch (e) {
    document.getElementById('servicesList').innerHTML = '<div class="empty"><h3>שגיאה</h3><p>' + e.message + '</p></div>';
  }
}

function renderServices() {
  const list = document.getElementById('servicesList');
  if (!state.services.length) {
    list.innerHTML = '<div class="empty"><h3>אין שירותים</h3></div>';
    return;
  }
  list.innerHTML = state.services.map((s, idx) => `
    <div class="proj-row" style="grid-template-columns:30px 1fr auto;">
      <div style="font-family:Inter;color:var(--text3);font-size:13px;">${String(idx+1).padStart(2,'0')}</div>
      <div class="proj-info">
        <h3>${escapeHtml(s.title)}</h3>
        <p style="margin-top:4px;">${escapeHtml((s.description || '').substring(0, 120))}${(s.description || '').length > 120 ? '...' : ''}</p>
      </div>
      <button class="btn btn-s btn-icon" onclick="openService('${s.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>
  `).join('');
}

function openService(id) {
  state.editingServiceId = id || null;
  const s = id ? state.services.find(x => x.id === id) : { id: '', title: '', description: '', color: 'web', icon: 'web', link: '', linkLabel: 'למידע נוסף' };
  if (!s) return;
  const html = `
    <div class="modal-bg open" id="svcModalBg" onclick="if(event.target.id==='svcModalBg')closeSvcModal()">
      <div class="modal">
        <h2>${id ? 'עריכת שירות' : 'שירות חדש'}</h2>
        <form id="svcForm">
          <div class="field"><label>מזהה</label><input name="id" required pattern="[a-z0-9-]+" value="${escapeHtml(s.id)}" ${id?'readonly':''}></div>
          <div class="field"><label>כותרת</label><input name="title" required value="${escapeHtml(s.title)}"></div>
          <div class="field"><label>תיאור</label><textarea name="description" required>${escapeHtml(s.description||'')}</textarea></div>
          <div class="field-row">
            <div class="field"><label>צבע</label><select name="color">${SVC_COLORS.map(c => `<option value="${c}" ${s.color===c?'selected':''}>${c}</option>`).join('')}</select></div>
            <div class="field"><label>אייקון</label><select name="icon">${SVC_ICON_OPTS.map(c => `<option value="${c}" ${s.icon===c?'selected':''}>${c}</option>`).join('')}</select></div>
          </div>
          <div class="field-row">
            <div class="field"><label>קישור (אופציונלי)</label><input name="link" value="${escapeHtml(s.link||'')}" placeholder="/workshops.html"></div>
            <div class="field"><label>תווית קישור</label><input name="linkLabel" value="${escapeHtml(s.linkLabel||'')}"></div>
          </div>
          <div class="modal-actions">
            ${id ? '<button type="button" class="btn btn-d" onclick="deleteService()">מחק</button>' : ''}
            <div style="display:flex;gap:8px;margin-inline-start:auto;">
              <button type="button" class="btn btn-s" onclick="closeSvcModal()">ביטול</button>
              <button type="submit" class="btn btn-p" id="svcSaveBtn">שמור</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div.firstElementChild);
  document.getElementById('svcForm').addEventListener('submit', saveService);
}

function closeSvcModal() {
  const el = document.getElementById('svcModalBg');
  if (el) el.remove();
  state.editingServiceId = null;
}

async function saveService(e) {
  e.preventDefault();
  const btn = document.getElementById('svcSaveBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span>';
  try {
    const fd = new FormData(e.target);
    const data = {};
    fd.forEach((v, k) => { data[k] = v; });
    let newSvc;
    if (state.editingServiceId) {
      newSvc = state.services.map(s => s.id === state.editingServiceId ? { ...s, ...data } : s);
    } else {
      if (state.services.find(s => s.id === data.id)) throw new Error('מזהה כבר קיים');
      newSvc = [...state.services, data];
    }
    const r = await fetch('/api/admin/services', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ services: newSvc, message: state.editingServiceId ? `Update service: ${data.id}` : `Add service: ${data.id}` }),
    });
    if (!r.ok) { const er = await r.json(); throw new Error(er.error); }
    state.services = newSvc;
    renderServices();
    document.getElementById('navCountServices').textContent = state.services.length;
    closeSvcModal();
    toast('נשמר!');
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'שמור';
  }
}

async function deleteService() {
  if (!state.editingServiceId) return;
  if (!confirm('למחוק את השירות?')) return;
  try {
    const newSvc = state.services.filter(s => s.id !== state.editingServiceId);
    const r = await fetch('/api/admin/services', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ services: newSvc, message: `Delete service: ${state.editingServiceId}` }),
    });
    if (!r.ok) { const er = await r.json(); throw new Error(er.error); }
    state.services = newSvc;
    renderServices();
    document.getElementById('navCountServices').textContent = state.services.length;
    closeSvcModal();
    toast('נמחק');
  } catch (e) { toast(e.message, true); }
}

// === FAQ ===
state.faqs = [];
state.editingFaqId = null;

async function loadFaqs() {
  try {
    const r = await fetch('/api/admin/faq');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    state.faqs = d.faqs || [];
    document.getElementById('navCountFaq').textContent = state.faqs.length;
    renderFaqs();
  } catch (e) {
    document.getElementById('faqList').innerHTML = '<div class="empty"><h3>שגיאה</h3><p>' + e.message + '</p></div>';
  }
}

function renderFaqs() {
  const list = document.getElementById('faqList');
  if (!state.faqs.length) {
    list.innerHTML = '<div class="empty"><h3>אין שאלות</h3></div>';
    return;
  }
  list.innerHTML = state.faqs.map((f, idx) => `
    <div class="proj-row" style="grid-template-columns:30px 1fr auto;">
      <div style="font-family:Inter;color:var(--text3);font-size:13px;">${idx+1}</div>
      <div class="proj-info">
        <h3>${escapeHtml(f.question)}</h3>
        <p style="margin-top:4px;">${escapeHtml((f.answer || '').substring(0, 130))}${(f.answer || '').length > 130 ? '...' : ''}</p>
      </div>
      <button class="btn btn-s btn-icon" onclick="openFaq('${f.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>
  `).join('');
}

function openFaq(id) {
  state.editingFaqId = id || null;
  const f = id ? state.faqs.find(x => x.id === id) : { id: '', question: '', answer: '' };
  if (!f) return;
  const html = `
    <div class="modal-bg open" id="faqModalBg" onclick="if(event.target.id==='faqModalBg')closeFaqModal()">
      <div class="modal">
        <h2>${id ? 'עריכת שאלה' : 'שאלה חדשה'}</h2>
        <form id="faqForm">
          <div class="field"><label>מזהה</label><input name="id" required pattern="[a-z0-9-]+" value="${escapeHtml(f.id)}" ${id?'readonly':''}></div>
          <div class="field"><label>השאלה</label><input name="question" required value="${escapeHtml(f.question)}"></div>
          <div class="field"><label>התשובה (פסקאות מופרדות בשורה ריקה)</label><textarea name="answer" required rows="8">${escapeHtml(f.answer||'')}</textarea></div>
          <div class="modal-actions">
            ${id ? '<button type="button" class="btn btn-d" onclick="deleteFaq()">מחק</button>' : ''}
            <div style="display:flex;gap:8px;margin-inline-start:auto;">
              <button type="button" class="btn btn-s" onclick="closeFaqModal()">ביטול</button>
              <button type="submit" class="btn btn-p" id="faqSaveBtn">שמור</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div.firstElementChild);
  document.getElementById('faqForm').addEventListener('submit', saveFaq);
}

function closeFaqModal() {
  const el = document.getElementById('faqModalBg');
  if (el) el.remove();
  state.editingFaqId = null;
}

async function saveFaq(e) {
  e.preventDefault();
  const btn = document.getElementById('faqSaveBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span>';
  try {
    const fd = new FormData(e.target);
    const data = {};
    fd.forEach((v, k) => { data[k] = v; });
    let newFaqs;
    if (state.editingFaqId) {
      newFaqs = state.faqs.map(f => f.id === state.editingFaqId ? { ...f, ...data } : f);
    } else {
      if (state.faqs.find(f => f.id === data.id)) throw new Error('מזהה כבר קיים');
      newFaqs = [...state.faqs, data];
    }
    const r = await fetch('/api/admin/faq', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ faqs: newFaqs, message: state.editingFaqId ? `Update FAQ: ${data.id}` : `Add FAQ: ${data.id}` }),
    });
    if (!r.ok) { const er = await r.json(); throw new Error(er.error); }
    state.faqs = newFaqs;
    renderFaqs();
    document.getElementById('navCountFaq').textContent = state.faqs.length;
    closeFaqModal();
    toast('נשמר!');
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'שמור';
  }
}

async function deleteFaq() {
  if (!state.editingFaqId) return;
  if (!confirm('למחוק את השאלה?')) return;
  try {
    const newFaqs = state.faqs.filter(f => f.id !== state.editingFaqId);
    const r = await fetch('/api/admin/faq', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ faqs: newFaqs, message: `Delete FAQ: ${state.editingFaqId}` }),
    });
    if (!r.ok) { const er = await r.json(); throw new Error(er.error); }
    state.faqs = newFaqs;
    renderFaqs();
    document.getElementById('navCountFaq').textContent = state.faqs.length;
    closeFaqModal();
    toast('נמחק');
  } catch (e) { toast(e.message, true); }
}

// === WORKSHOPS ===
state.workshops = [];
state.editingWorkshopId = null;

async function loadWorkshops() {
  try {
    const r = await fetch('/api/admin/workshops');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    state.workshops = d.workshops || [];
    document.getElementById('navCountWorkshops').textContent = state.workshops.length;
    renderWorkshops();
  } catch (e) {
    document.getElementById('workshopsList').innerHTML = '<div class="empty"><h3>שגיאה</h3><p>' + e.message + '</p></div>';
  }
}

const WS_COLORS = ['cyan','purple','blue','green','orange','pink'];

function renderWorkshops() {
  const list = document.getElementById('workshopsList');
  if (!state.workshops.length) {
    list.innerHTML = '<div class="empty"><h3>אין סדנאות</h3></div>';
    return;
  }
  list.innerHTML = state.workshops.map(w => `
    <div class="proj-row" style="grid-template-columns:48px 1fr auto;">
      <div class="stat-icon ${w.color || 'purple'}" style="margin:0;width:48px;height:48px;border-radius:12px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
      </div>
      <div class="proj-info">
        <h3>${escapeHtml(w.title)}</h3>
        <div><span class="badge">${escapeHtml(w.duration || '')}</span><span class="meta">${escapeHtml(w.format || '')} ${w.published ? '· פעילה' : '· טיוטה'}</span></div>
        <p style="margin-top:6px;">${escapeHtml((w.description || '').substring(0, 110))}${(w.description || '').length > 110 ? '...' : ''}</p>
      </div>
      <button class="btn btn-s btn-icon" onclick="openWorkshop('${w.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>
  `).join('');
}

function openWorkshop(id) {
  state.editingWorkshopId = id || null;
  const w = id ? state.workshops.find(x => x.id === id) : { id: '', title: '', color: 'purple', description: '', bullets: [], audience: '', duration: '', format: '', published: true };
  if (!w) return;
  const bulletsStr = (w.bullets || []).join('\n');
  const html = `
    <div class="modal-bg open" id="wsModalBg" onclick="if(event.target.id==='wsModalBg')closeWsModal()">
      <div class="modal">
        <h2>${id ? 'עריכת סדנה' : 'סדנה חדשה'}</h2>
        <form id="wsForm">
          <div class="field-row">
            <div class="field"><label>מזהה</label><input name="id" required pattern="[a-z0-9-]+" value="${escapeHtml(w.id)}" ${id?'readonly':''}></div>
            <div class="field"><label>צבע תמה</label><select name="color">
              ${WS_COLORS.map(c => `<option value="${c}" ${w.color===c?'selected':''}>${c}</option>`).join('')}
            </select></div>
          </div>
          <div class="field"><label>כותרת</label><input name="title" required value="${escapeHtml(w.title)}"></div>
          <div class="field"><label>תיאור</label><textarea name="description" required>${escapeHtml(w.description||'')}</textarea></div>
          <div class="field"><label>נושאים (כל אחד בשורה נפרדת)</label><textarea name="bullets" rows="6">${escapeHtml(bulletsStr)}</textarea></div>
          <div class="field"><label>קהל יעד</label><textarea name="audience">${escapeHtml(w.audience||'')}</textarea></div>
          <div class="field-row">
            <div class="field"><label>משך</label><input name="duration" value="${escapeHtml(w.duration||'')}" placeholder="3-4 שעות"></div>
            <div class="field"><label>פורמט</label><input name="format" value="${escapeHtml(w.format||'')}" placeholder="מעשית עם תרגול"></div>
          </div>
          <div class="field-check"><input type="checkbox" name="published" id="wsPub" ${w.published?'checked':''}><label for="wsPub">פעילה (מוצגת באתר)</label></div>
          <div class="modal-actions">
            ${id ? '<button type="button" class="btn btn-d" onclick="deleteWs()">מחק</button>' : ''}
            <div style="display:flex;gap:8px;margin-inline-start:auto;">
              <button type="button" class="btn btn-s" onclick="closeWsModal()">ביטול</button>
              <button type="submit" class="btn btn-p" id="wsSaveBtn">שמור</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div.firstElementChild);
  document.getElementById('wsForm').addEventListener('submit', saveWs);
}

function closeWsModal() {
  const el = document.getElementById('wsModalBg');
  if (el) el.remove();
  state.editingWorkshopId = null;
}

async function saveWs(e) {
  e.preventDefault();
  const btn = document.getElementById('wsSaveBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span>';
  try {
    const fd = new FormData(e.target);
    const data = {};
    fd.forEach((v, k) => { data[k] = v; });
    data.bullets = (data.bullets || '').split('\n').map(s => s.trim()).filter(Boolean);
    data.published = !!e.target.published.checked;
    let newWs;
    if (state.editingWorkshopId) {
      newWs = state.workshops.map(w => w.id === state.editingWorkshopId ? { ...w, ...data } : w);
    } else {
      if (state.workshops.find(w => w.id === data.id)) throw new Error('מזהה כבר קיים');
      newWs = [...state.workshops, data];
    }
    const r = await fetch('/api/admin/workshops', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workshops: newWs, message: state.editingWorkshopId ? `Update workshop: ${data.id}` : `Add workshop: ${data.id}` }),
    });
    if (!r.ok) { const er = await r.json(); throw new Error(er.error); }
    state.workshops = newWs;
    renderWorkshops();
    document.getElementById('navCountWorkshops').textContent = state.workshops.length;
    closeWsModal();
    toast('נשמר!');
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'שמור';
  }
}

async function deleteWs() {
  if (!state.editingWorkshopId) return;
  if (!confirm('למחוק את הסדנה?')) return;
  try {
    const newWs = state.workshops.filter(w => w.id !== state.editingWorkshopId);
    const r = await fetch('/api/admin/workshops', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workshops: newWs, message: `Delete workshop: ${state.editingWorkshopId}` }),
    });
    if (!r.ok) { const er = await r.json(); throw new Error(er.error); }
    state.workshops = newWs;
    renderWorkshops();
    document.getElementById('navCountWorkshops').textContent = state.workshops.length;
    closeWsModal();
    toast('נמחק');
  } catch (e) { toast(e.message, true); }
}

// === IMAGE UPLOAD HELPER ===
async function uploadImage(file, folder) {
  const fd = new FormData();
  fd.append('file', file);
  if (folder) fd.append('folder', folder);
  const r = await fetch('/api/admin/upload-image', { method: 'POST', body: fd });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'upload failed');
  return d.path;
}

// Set up drag&drop on .image-drop containers
document.addEventListener('dragover', e => {
  const zone = e.target.closest('.image-drop');
  if (!zone) return;
  e.preventDefault();
  zone.classList.add('dragover');
});
document.addEventListener('dragleave', e => {
  const zone = e.target.closest('.image-drop');
  if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('dragover');
});
document.addEventListener('drop', async e => {
  const zone = e.target.closest('.image-drop');
  if (!zone) return;
  e.preventDefault();
  zone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) {
    toast('זה לא קובץ תמונה', true);
    return;
  }
  const targetId = zone.getAttribute('data-target');
  const target = document.getElementById(targetId);
  if (!target) return;
  target.placeholder = 'מעלה...';
  target.disabled = true;
  try {
    const path = await uploadImage(file, 'uploads');
    target.value = path;
    target.disabled = false;
    toast('התמונה הועלתה!');
  } catch (ex) {
    toast('שגיאה: ' + ex.message, true);
    target.disabled = false;
  }
});

// Mobile sidebar drawer + scrim
function toggleSidebar(force) {
  const aside = document.querySelector('aside');
  const scrim = document.getElementById('navScrim');
  const open = force === undefined ? !aside.classList.contains('open') : force;
  aside.classList.toggle('open', open);
  if (scrim) scrim.classList.toggle('open', open);
}
// Close mobile sidebar on nav item click
document.addEventListener('click', e => {
  if (window.innerWidth <= 900 && e.target.closest('.nav-item[data-view]')) {
    toggleSidebar(false);
  }
});

async function handleImageSelect(inputEl, targetFieldId) {
  if (!inputEl.files || !inputEl.files[0]) return;
  const file = inputEl.files[0];
  const target = document.getElementById(targetFieldId);
  const originalPlaceholder = target.placeholder;
  target.placeholder = 'מעלה...';
  target.disabled = true;
  try {
    const path = await uploadImage(file, 'uploads');
    target.value = path;
    target.disabled = false;
    toast('התמונה הועלתה!');
  } catch (e) {
    toast('שגיאה בהעלאה: ' + e.message, true);
    target.disabled = false;
    target.placeholder = originalPlaceholder;
  }
  inputEl.value = '';
}

// === SYSTEM / HELP ===
function loadSystem() {
  const services = [
    { name: 'GitHub', role: 'אחסון קוד וקבצי JSON של כל התוכן', url: 'https://github.com/Yarin-ops/yarinmalka-site', dashboard: 'github.com' },
    { name: 'Cloudflare Pages', role: 'אחסון ופריסת האתר + הרצת ה-API', url: 'https://dash.cloudflare.com', dashboard: 'dash.cloudflare.com' },
    { name: 'Cloudflare Access', role: 'הגנת אזור הניהול (אופציונלי)', url: 'https://one.dash.cloudflare.com', dashboard: 'one.dash.cloudflare.com' },
    { name: 'Cloudflare Web Analytics', role: 'מעקב צפיות ומבקרים אמיתיים', url: 'https://dash.cloudflare.com', dashboard: 'dash.cloudflare.com → Analytics' },
    { name: 'MailerLite', role: 'ניהול רשימת תפוצה ושליחת מיילים', url: 'https://dashboard.mailerlite.com', dashboard: 'dashboard.mailerlite.com' },
    { name: 'Make.com', role: 'אוטומציה - שולח לך מייל על כל פנייה חדשה', url: 'https://eu2.make.com', dashboard: 'eu2.make.com' },
  ];
  document.getElementById('sysServices').innerHTML = services.map(s => `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--glass-border);">
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:2px;">${s.name}</div>
        <div style="font-size:12px;color:var(--text2);">${s.role}</div>
      </div>
      <a href="${s.url}" target="_blank" rel="noopener" style="font-size:12px;color:var(--accent-light);text-decoration:none;white-space:nowrap;">פתח דאשבורד ↗</a>
    </div>
  `).join('');

  const datasources = [
    { label: 'פרויקטים', path: 'assets/data/projects.json', editPath: '#projects', editLabel: 'ערוך באדמין' },
    { label: 'סדנאות', path: 'assets/data/workshops.json', editPath: '#workshops', editLabel: 'ערוך באדמין' },
    { label: 'שירותים', path: 'assets/data/services.json', editPath: '#services', editLabel: 'ערוך באדמין' },
    { label: 'טסטימוניאלים', path: 'assets/data/testimonials.json', editPath: '#testimonials', editLabel: 'ערוך באדמין' },
    { label: 'שאלות נפוצות', path: 'assets/data/faq.json', editPath: '#faq', editLabel: 'ערוך באדמין' },
    { label: 'הגדרות אתר', path: 'assets/data/settings.json', editPath: '#settings', editLabel: 'ערוך באדמין' },
    { label: 'פניות', path: 'assets/data/inquiries.json', editPath: '#inquiries', editLabel: 'צפה באדמין' },
    { label: 'מדריכים (HTML)', path: 'guides/*.html', editPath: 'https://github.com/Yarin-ops/yarinmalka-site/tree/main/guides', editLabel: 'ערוך ב-GitHub ↗', external: true },
    { label: 'תמונות', path: 'assets/*.jpg/png', editPath: 'https://github.com/Yarin-ops/yarinmalka-site/tree/main/assets', editLabel: 'ערוך ב-GitHub ↗', external: true },
  ];
  document.getElementById('sysDatasources').innerHTML = datasources.map(d => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--glass-border);">
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:2px;">${d.label}</div>
        <div style="font-size:11px;color:var(--text3);font-family:Inter;direction:ltr;text-align:right;">${d.path}</div>
      </div>
      <a href="${d.editPath}" ${d.external ? 'target="_blank" rel="noopener"' : ''} style="font-size:12px;color:var(--accent-light);text-decoration:none;white-space:nowrap;">${d.editLabel}</a>
    </div>
  `).join('');

  const howto = [
    { q: 'איך אני משנה תמונה של פרויקט?', a: 'פרויקטים → פתח את הפרויקט → גרור תמונה לתוך השדה "תמונה" או לחץ "העלה". התמונה תועלה אוטומטית ל-GitHub והקישור יושלם.' },
    { q: 'איך מוסיפים שאלה ל-FAQ?', a: 'שאלות נפוצות → "שאלה חדשה" → ממלאים → שמור. תופיע בעמוד הבית תוך 30 שניות.' },
    { q: 'איך משנים מספר טלפון/אימייל בכל האתר?', a: 'הגדרות אתר → עורכים את הטלפון/אימייל → שמור. מתעדכן בפוטר וכל מקום באתר אוטומטית.' },
    { q: 'איך מסמנים פנייה כנענתה?', a: 'פניות אחרונות → לוחצים על הסימן ✓ בכרטיס הפנייה. סטטוס יעבור ל"נענה".' },
    { q: 'איך אני מתנתק?', a: 'הכפתור "התנתק" בתחתית הסיידבר (אדום). מוחק את ה-session וצריך להזין סיסמה שוב.' },
    { q: 'איך מחליפים סיסמת אדמין?', a: 'דרך Cloudflare Pages → Settings → Environment Variables → שנה את ADMIN_PASSWORD → trigger redeploy.' },
    { q: 'איך מקבלים התראה על פנייה חדשה?', a: 'אוטומטי. כל פנייה שולחת trigger ל-Make.com שמשגר לך מייל עם פרטי הפנייה.' },
    { q: 'איך משנים את התמונה הראשית בעמוד הבית?', a: 'כרגע ידנית - עורכים ב-GitHub את קובץ assets/yarin-photo.png. בהמשך נוסיף לאדמין.' },
  ];
  document.getElementById('sysHowto').innerHTML = howto.map(h => `
    <details style="padding:10px 12px;border:1px solid var(--glass-border);border-radius:10px;margin-bottom:6px;cursor:pointer;">
      <summary style="font-size:13px;font-weight:500;color:var(--text);list-style:none;display:flex;justify-content:space-between;align-items:center;">
        <span>${h.q}</span><span style="color:var(--accent-light);">+</span>
      </summary>
      <p style="margin-top:8px;font-size:13px;color:var(--text2);line-height:1.7;">${h.a}</p>
    </details>
  `).join('');

  const troubleshoot = [
    { q: 'שמירה באדמין נכשלת', a: 'בדוק: 1. ה-token של GitHub עדיין תקף (90 ימים מהיצירה). 2. ל-token יש הרשאת Contents:Read+Write. 3. ה-GITHUB_TOKEN env var ב-Cloudflare Pages מוגדר.' },
    { q: 'שינוי באדמין לא מופיע באתר', a: 'המתן 30-60 שניות (זמן deploy). אם עדיין לא - בדוק ב-Cloudflare Pages Deployments שאין deploy שכשל.' },
    { q: 'אנליטיקס מציג שגיאה', a: 'הטוקן CF_ANALYTICS_TOKEN חסר או פג תוקף. צור חדש ב-Cloudflare Profile → API Tokens (Zone Analytics:Read + Account Analytics:Read).' },
    { q: 'רשימת תפוצה לא נטענת', a: 'בדוק שה-MAILERLITE_TOKEN ב-Cloudflare env vars תקין. כניסה ל-MailerLite Dashboard → Integrations → API → ודא שהמפתח פעיל.' },
    { q: 'לא מקבלים מיילים על פניות', a: 'בדוק ב-Make.com שה-scenario "Yarinmalka Contact Email Notification" פעיל (ירוק). בדוק היסטוריית הרצות.' },
    { q: 'האדמין לא נטען בכלל', a: 'בדוק: 1. שאתה ב-/admin (אותיות קטנות). 2. שיש Cookie של אימות (התנתק והתחבר שוב). 3. בדוק Console בדפדפן לשגיאות JS.' },
  ];
  document.getElementById('sysTroubleshoot').innerHTML = troubleshoot.map(t => `
    <details style="padding:10px 12px;border:1px solid var(--glass-border);border-radius:10px;margin-bottom:6px;cursor:pointer;">
      <summary style="font-size:13px;font-weight:500;color:var(--text);list-style:none;display:flex;justify-content:space-between;align-items:center;">
        <span>${t.q}</span><span style="color:var(--accent-light);">+</span>
      </summary>
      <p style="margin-top:8px;font-size:13px;color:var(--text2);line-height:1.7;">${t.a}</p>
    </details>
  `).join('');
}

// === AUTH FLOW ===
async function checkAuth() {
  try {
    const r = await fetch('/api/admin/me');
    if (r.ok) {
      const d = await r.json();
      document.getElementById('userEmail').textContent = d.email || 'admin';
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appWrap').style.display = 'grid';
      loadDashboard();
      return true;
    }
  } catch (e) {}
  // not authenticated - show login
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appWrap').style.display = 'none';
  setTimeout(() => document.getElementById('loginPassword').focus(), 100);
  return false;
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const btnText = document.getElementById('loginBtnText');
  const err = document.getElementById('loginErr');
  btn.disabled = true;
  btnText.innerHTML = '<span class="loading"></span>';
  err.classList.remove('show');
  try {
    const password = document.getElementById('loginPassword').value;
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'שגיאה');
    // Success - reload to pick up cookie
    window.location.reload();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.add('show');
    btn.disabled = false;
    btnText.textContent = 'היכנס';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginPassword').focus();
  }
});

async function logout() {
  await fetch('/api/admin/logout', { method: 'POST' });
  // Also logout from Cloudflare Access if active
  try {
    await fetch('/cdn-cgi/access/logout', { method: 'GET', credentials: 'same-origin' });
  } catch (e) {}
  window.location.reload();
}

checkAuth();

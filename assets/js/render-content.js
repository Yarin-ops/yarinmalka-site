// Dynamic content renderer - runs on public pages that need to load JSON data.
// Each render function checks if its target container exists, otherwise skips.

(function () {
  'use strict';

  const escape = (s) => (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const errBox = (container, msg = 'שגיאה בטעינה') =>
    `<div style="text-align:center;padding:40px;color:var(--text3);grid-column:1/-1;">${msg}</div>`;

  // === WORKSHOPS (workshops.html) ===
  const WS_ICONS = {
    bulb: 'M9 18h6M10 22h4M12 2a7 7 0 00-4 12.5V17h8v-2.5A7 7 0 0012 2z',
    star: 'M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6l-5 3.6 1.9-5.8L4 8.8h6.1z',
    briefcase: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16',
    compass: 'M12 22a10 10 0 100-20 10 10 0 000 20zM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36z',
    'user-plus': 'M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6',
  };

  function renderWorkshop(w) {
    const path = WS_ICONS[w.icon] || WS_ICONS.bulb;
    const bullets = (w.bullets || []).map(b => `<li>${escape(b)}</li>`).join('');
    return `<article class="workshop-card ws-${escape(w.color || 'purple')} reveal visible">
      <div class="workshop-head">
        <div class="workshop-icon"><svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="${path}"/></svg></div>
        <div><h3>${escape(w.title)}</h3><p>${escape(w.description)}</p></div>
      </div>
      <div class="workshop-body">
        <div class="workshop-section"><h4>מה תלמדו</h4><ul>${bullets}</ul></div>
        <div class="workshop-target"><strong>למי זה מתאים:</strong> ${escape(w.audience || '')}</div>
      </div>
      <div class="workshop-foot">
        <div class="workshop-meta">
          <span><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${escape(w.duration || '')}</span>
          <span><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${escape(w.format || '')}</span>
        </div>
        <a href="/contact.html" class="workshop-cta">להתעניין <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg></a>
      </div>
    </article>`;
  }

  async function loadWorkshops() {
    const el = document.getElementById('workshopsGrid');
    if (!el) return;
    try {
      const d = await fetch('/assets/data/workshops.json').then(r => r.json());
      const items = (d.workshops || []).filter(w => w.published !== false);
      el.innerHTML = items.length ? items.map(renderWorkshop).join('') : errBox(el, 'אין סדנאות');
    } catch (_) { el.innerHTML = errBox(el); }
  }

  // === TESTIMONIALS (index.html) ===
  function renderTesti(t) {
    const stars = Array(t.rating || 5).fill('<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>').join('');
    const roleHtml = t.link
      ? `<a href="${escape(t.link)}" target="_blank" rel="noopener" class="testi-role" style="color:var(--accent-light);text-decoration:none;">${escape(t.role || '')} →</a>`
      : `<div class="testi-role">${escape(t.role || '')}</div>`;
    return `<div class="glass testi-card reveal visible">
      <div class="testi-quote">"</div>
      <div class="testi-stars">${stars}</div>
      <blockquote>${escape(t.quote)}</blockquote>
      <div class="testi-author">
        <div class="testi-avatar"><img src="/${escape(t.avatar)}" alt="${escape(t.name)}"></div>
        <div>
          <div class="testi-name">${escape(t.name)}</div>
          ${roleHtml}
        </div>
      </div>
    </div>`;
  }

  async function loadTestimonials() {
    const el = document.getElementById('testiGrid');
    if (!el) return;
    try {
      const d = await fetch('/assets/data/testimonials.json').then(r => r.json());
      const items = d.testimonials || [];
      el.innerHTML = items.length ? items.map(renderTesti).join('') : errBox(el, 'אין המלצות');
    } catch (_) { el.innerHTML = errBox(el); }
  }

  // === FAQ (index.html) ===
  function renderFaq(f) {
    const paras = (f.answer || '').split(/\n\n+/).map(p => `<p>${escape(p)}</p>`).join('');
    return `<details class="faq-item">
      <summary>
        <span>${escape(f.question)}</span>
        <svg class="faq-chev" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </summary>
      <div class="faq-body">${paras}</div>
    </details>`;
  }

  async function loadFaq() {
    const el = document.getElementById('faqList');
    if (!el) return;
    try {
      const d = await fetch('/assets/data/faq.json').then(r => r.json());
      const items = d.faqs || [];
      el.innerHTML = items.length ? items.map(renderFaq).join('') : errBox(el, 'אין שאלות');
    } catch (_) { el.innerHTML = errBox(el); }
  }

  // === SERVICES (index.html) ===
  const SVC_ICONS = {
    web: '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    finance: '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
    academy: '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>',
  };

  function renderService(s, i) {
    const num = String(i + 1).padStart(2, '0');
    const icon = SVC_ICONS[s.icon] || SVC_ICONS.web;
    const arrow = '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>';
    const inner = `<div class="srv-num" aria-hidden="true" data-num="${num}"></div><div class="srv-icon">${icon}</div><h3>${escape(s.title)}</h3><p>${escape(s.description)}</p><span class="srv-link">${escape(s.linkLabel || 'למידע נוסף')} ${arrow}</span>`;
    if (s.link) {
      return `<a href="${escape(s.link)}" data-tilt class="glass srv-card ${escape(s.color || 'web')} reveal visible" style="text-decoration:none;color:inherit">${inner}</a>`;
    }
    return `<div data-tilt class="glass srv-card ${escape(s.color || 'web')} reveal visible">${inner}</div>`;
  }

  async function loadServices() {
    const el = document.getElementById('srvGrid');
    if (!el) return;
    try {
      const d = await fetch('/assets/data/services.json').then(r => r.json());
      const items = d.services || [];
      el.innerHTML = items.length ? items.map(renderService).join('') : errBox(el, 'אין שירותים');
    } catch (_) { el.innerHTML = errBox(el); }
  }

  // Run all - each is a no-op if its container doesn't exist
  loadWorkshops();
  loadTestimonials();
  loadFaq();
  loadServices();
})();

(function () {
  'use strict';

  const STORAGE_KEY = 'a11y-settings';
  const DISMISS_KEY = 'a11y-dismissed';
  const defaults = {
    textSize: 0,
    noMotion: false,
    underlineLinks: false,
    readableFont: false,
    highContrast: false,
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, defaults);
      return Object.assign({}, defaults, JSON.parse(raw));
    } catch (_) {
      return Object.assign({}, defaults);
    }
  }

  function save(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) {}
  }

  const state = load();

  function apply() {
    const html = document.documentElement;
    html.classList.remove('a11y-large-1', 'a11y-large-2', 'a11y-large-3');
    if (state.textSize === 1) html.classList.add('a11y-large-1');
    if (state.textSize === 2) html.classList.add('a11y-large-2');
    if (state.textSize === 3) html.classList.add('a11y-large-3');
    html.classList.toggle('a11y-no-motion', state.noMotion);
    html.classList.toggle('a11y-underline-links', state.underlineLinks);
    html.classList.toggle('a11y-readable-font', state.readableFont);
    html.classList.toggle('a11y-high-contrast', state.highContrast);
  }

  apply();

  function setState(key, val) {
    state[key] = val;
    save(state);
    apply();
    renderToggles();
  }

  function isDismissed() {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch (_) { return false; }
  }
  function setDismissed(v) {
    try { v ? sessionStorage.setItem(DISMISS_KEY, '1') : sessionStorage.removeItem(DISMISS_KEY); } catch (_) {}
  }

  const A11Y_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="15" cy="3.5" r="1.7"/><path d="M13 6.5c-.83 0-1.5.67-1.5 1.5v4c0 .55.45 1 1 1h3v2h-2v2h2.5c.55 0 1-.45 1-1V14h1.5l1.5 3c.28.5.92.66 1.4.37.49-.28.65-.91.37-1.4l-2-3.5a1 1 0 0 0-.87-.5H17V9c0-1.4-.93-2.5-2-2.5h-2z"/><circle cx="10" cy="17.5" r="4.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';

  function render() {
    if (document.getElementById('a11yDock')) return;

    const dock = document.createElement('div');
    dock.id = 'a11yDock';
    dock.className = 'a11y-dock';
    if (isDismissed()) dock.classList.add('dismissed');
    dock.innerHTML = [
      '<button class="a11y-btn" id="a11yBtn" aria-label="הגדרות נגישות" aria-expanded="false">',
      A11Y_ICON,
      '</button>',
      '<button class="a11y-dismiss" id="a11yDismiss" aria-label="הסתר כפתור נגישות" title="הסתר עד טעינה הבאה">×</button>',
    ].join('');

    const reopen = document.createElement('button');
    reopen.id = 'a11yReopen';
    reopen.className = 'a11y-reopen';
    reopen.setAttribute('aria-label', 'הצג כפתור נגישות');
    reopen.title = 'הצג נגישות';
    if (isDismissed()) reopen.classList.add('show');

    const panel = document.createElement('div');
    panel.id = 'a11yPanel';
    panel.className = 'a11y-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'התאמות נגישות');
    panel.innerHTML = [
      '<div class="a11y-panel-header">',
      '  <h3>התאמות נגישות</h3>',
      '  <button class="a11y-close" aria-label="סגור פאנל" data-act="close">×</button>',
      '</div>',
      '<div class="a11y-section">',
      '  <div class="a11y-section-title">גודל טקסט</div>',
      '  <div class="a11y-row">',
      '    <button class="a11y-action" data-act="text-down" aria-label="הקטן טקסט">— הקטן</button>',
      '    <button class="a11y-action" data-act="text-up" aria-label="הגדל טקסט">הגדל +</button>',
      '  </div>',
      '</div>',
      '<div class="a11y-section">',
      '  <div class="a11y-section-title">תצוגה</div>',
      '  <button class="a11y-toggle" data-toggle="highContrast" aria-pressed="false">',
      '    <span>ניגודיות גבוהה</span><span class="a11y-switch"></span>',
      '  </button>',
      '  <button class="a11y-toggle" data-toggle="underlineLinks" aria-pressed="false">',
      '    <span>הדגש קישורים</span><span class="a11y-switch"></span>',
      '  </button>',
      '  <button class="a11y-toggle" data-toggle="readableFont" aria-pressed="false">',
      '    <span>גופן קריא</span><span class="a11y-switch"></span>',
      '  </button>',
      '</div>',
      '<div class="a11y-section">',
      '  <div class="a11y-section-title">תנועה</div>',
      '  <button class="a11y-toggle" data-toggle="noMotion" aria-pressed="false">',
      '    <span>עצור אנימציות</span><span class="a11y-switch"></span>',
      '  </button>',
      '</div>',
      '<div class="a11y-footer">',
      '  <a href="/accessibility.html">הצהרת נגישות</a>',
      '  <button class="a11y-reset" data-act="reset">איפוס</button>',
      '</div>',
    ].join('');

    document.body.appendChild(dock);
    document.body.appendChild(reopen);
    document.body.appendChild(panel);

    const btn = document.getElementById('a11yBtn');
    const dismiss = document.getElementById('a11yDismiss');

    btn.addEventListener('click', function () {
      const isOpen = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (isOpen) renderToggles();
    });

    dismiss.addEventListener('click', function (e) {
      e.stopPropagation();
      setDismissed(true);
      dock.classList.add('dismissed');
      reopen.classList.add('show');
      panel.classList.remove('open');
    });

    reopen.addEventListener('click', function () {
      setDismissed(false);
      dock.classList.remove('dismissed');
      reopen.classList.remove('show');
      btn.focus();
    });

    panel.addEventListener('click', function (e) {
      const t = e.target.closest('[data-act],[data-toggle]');
      if (!t) return;
      const act = t.getAttribute('data-act');
      const tog = t.getAttribute('data-toggle');
      if (act === 'close') {
        panel.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      } else if (act === 'text-up') {
        if (state.textSize < 3) setState('textSize', state.textSize + 1);
      } else if (act === 'text-down') {
        if (state.textSize > 0) setState('textSize', state.textSize - 1);
      } else if (act === 'reset') {
        Object.keys(defaults).forEach(function (k) { state[k] = defaults[k]; });
        save(state); apply(); renderToggles();
      } else if (tog) {
        setState(tog, !state[tog]);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) {
        panel.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (!panel.classList.contains('open')) return;
      if (panel.contains(e.target) || dock.contains(e.target)) return;
      panel.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function renderToggles() {
    const panel = document.getElementById('a11yPanel');
    if (!panel) return;
    const toggles = panel.querySelectorAll('[data-toggle]');
    toggles.forEach(function (el) {
      const k = el.getAttribute('data-toggle');
      el.setAttribute('aria-pressed', state[k] ? 'true' : 'false');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();

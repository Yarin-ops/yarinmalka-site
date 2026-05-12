(function () {
  'use strict';

  const DATA = [
    { cat: 'שירותים', q: 'מה אתה בעצם בונה?', a: 'אתרי תדמית, חנויות, מערכות ניהול, אפליקציות ואוטומציות. אני עובד בעיקר ב-React/Next.js וב-Base44 לפרויקטים מהירים. כל פרויקט מותאם אישית, בלי תבניות.' },
    { cat: 'שירותים', q: 'אתה גם מעצב או רק מפתח?', a: 'גם וגם. אני מתכנן UX, מעצב ב-Figma, ומפתח בקוד. ככה התוצר מגיע אחיד וקוהרנטי בלי לתאם בין כמה אנשי מקצוע.' },
    { cat: 'מחירים', q: 'כמה עולה אתר?', a: 'תלוי בהיקף. אתר תדמית בסיסי: ₪3,500-8,000. חנות או מערכת: ₪8,000-25,000. פרויקטים מורכבים: לפי הצעה. אחרי שאלון אפיון אחזור עם הצעה מדויקת.' },
    { cat: 'מחירים', q: 'המחיר כולל אחסון ודומיין?', a: 'דומיין ראשון על חשבוני. אחסון ב-Cloudflare/Vercel חינמי לרוב האתרים. אם צריך שרת ייעודי - מצרף עלות שקופה ללא תיווך.' },
    { cat: 'תהליך', q: 'כמה זמן לוקח לבנות?', a: 'אתר תדמית: 2-3 שבועות. מערכת או חנות: 4-8 שבועות. תלוי גם בקצב שלך - מה שמעכב הכי הרבה זה אישורי תוכן ועיצוב.' },
    { cat: 'תהליך', q: 'איך מתחילים פרויקט?', a: 'ממלאים שאלון אפיון קצר (10 דק׳), אני מחזיר הצעת מחיר תוך 48 שעות. אם מאשרים - חתימה, מקדמה 30%, ועדכונים שבועיים על ההתקדמות.' },
    { cat: 'תהליך', q: 'מה קורה אחרי שהאתר עולה?', a: '30 ימי תמיכה כלולים לכל באג או תיקון. אחרי זה - חבילת תחזוקה חודשית אופציונלית (₪300-800), או תיקונים נקודתיים לפי שעה.' },
    { cat: 'סדנאות וייעוץ', q: 'הסדנאות לפרטיים או רק לחברות?', a: 'משני הסוגים. הסדנאות הפתוחות (AI לעבודה יומיומית, חשיבה עסקית) מתאימות גם לפרטיים. סדנאות מותאמות לצוות או חברה - נבנות אישית.' },
    { cat: 'סדנאות וייעוץ', q: 'אתה גם יועץ פיננסי?', a: 'כן. אני יועץ פיננסי בתחילת רישוי (מבחן מקצועית א׳ ב-6/2026). מלווה עסקים בתכנון תזרים, מימון, וקבלת החלטות פיננסיות. שיחת היכרות ראשונה ללא עלות.' },
    { cat: 'תוכן', q: 'המדריכים בחינם?', a: 'כן, לחלוטין. כל המדריכים באתר חופשיים לקריאה. מי שמצטרף לרשימת התפוצה מקבל גם מדריכים נוספים, גישה מוקדמת לתוכן וטיפים פרקטיים.' },
  ];

  const SEEN_KEY = 'faq-seen';
  let activeCat = 'הכל';
  let activeQuery = '';

  function isSeen() {
    try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (_) { return false; }
  }
  function setSeen() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) {}
  }

  function categories() {
    const set = new Set(['הכל']);
    DATA.forEach(d => set.add(d.cat));
    return Array.from(set);
  }

  function filter() {
    const q = activeQuery.trim().toLowerCase();
    return DATA.filter(d => {
      if (activeCat !== 'הכל' && d.cat !== activeCat) return false;
      if (!q) return true;
      return d.q.toLowerCase().includes(q) || d.a.toLowerCase().includes(q);
    });
  }

  function renderList(panel) {
    const list = panel.querySelector('.faq-list');
    const items = filter();
    if (items.length === 0) {
      list.innerHTML = '<div class="faq-empty"><strong>לא מצאתי תשובה בנושא הזה.</strong>אבל אענה לך אישית. <a href="https://wa.me/972536805136" target="_blank" rel="noopener">לחץ כאן ב-WhatsApp</a></div>';
      return;
    }
    list.innerHTML = items.map((d, i) => (
      '<div class="faq-item" data-i="' + i + '">' +
        '<div class="faq-q">' + d.q + '</div>' +
        '<div class="faq-a">' + d.a + '</div>' +
      '</div>'
    )).join('');
    list.querySelectorAll('.faq-item').forEach(el => {
      el.addEventListener('click', () => el.classList.toggle('open'));
    });
  }

  function renderCats(panel) {
    const cats = panel.querySelector('.faq-cats');
    cats.innerHTML = categories().map(c => (
      '<button class="faq-cat ' + (c === activeCat ? 'active' : '') + '" data-cat="' + c + '">' + c + '</button>'
    )).join('');
    cats.querySelectorAll('.faq-cat').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCat = btn.getAttribute('data-cat');
        renderCats(panel);
        renderList(panel);
      });
    });
  }

  function render() {
    if (document.getElementById('faqBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'faqBtn';
    btn.className = 'faq-btn' + (isSeen() ? ' seen' : '');
    btn.setAttribute('aria-label', 'שאלות נפוצות');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

    const panel = document.createElement('div');
    panel.id = 'faqPanel';
    panel.className = 'faq-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'שאלות נפוצות');
    panel.innerHTML = [
      '<div class="faq-header">',
      '  <button class="faq-close" aria-label="סגור">×</button>',
      '  <div class="faq-title">שאלות נפוצות</div>',
      '  <div class="faq-sub">לא מצאת? כתוב לי ב-WhatsApp ואענה אישית.</div>',
      '  <input type="search" class="faq-search" placeholder="חיפוש...">',
      '</div>',
      '<div class="faq-cats"></div>',
      '<div class="faq-list"></div>',
      '<div class="faq-footer">',
      '  <a href="https://wa.me/972536805136" target="_blank" rel="noopener">',
      '    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487"/></svg>',
      '    שלח שאלה ב-WhatsApp',
      '  </a>',
      '</div>',
    ].join('');

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    renderCats(panel);
    renderList(panel);

    btn.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (isOpen) {
        setSeen();
        btn.classList.add('seen');
        setTimeout(() => {
          const inp = panel.querySelector('.faq-search');
          if (inp) inp.focus();
        }, 100);
      }
    });

    panel.querySelector('.faq-close').addEventListener('click', () => {
      panel.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });

    panel.querySelector('.faq-search').addEventListener('input', (e) => {
      activeQuery = e.target.value;
      renderList(panel);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('open')) {
        panel.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      }
    });

    document.addEventListener('click', (e) => {
      if (!panel.classList.contains('open')) return;
      if (panel.contains(e.target) || btn.contains(e.target)) return;
      panel.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();

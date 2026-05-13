(function () {
  fetch('/assets/data/settings.json').then(r => r.json()).then(s => {
    const get = (path) => path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), s);

    // data-setting="path" - sets textContent
    document.querySelectorAll('[data-setting]').forEach(el => {
      const v = get(el.getAttribute('data-setting'));
      if (v !== undefined) el.textContent = v;
    });

    // data-setting-href="path:scheme" - sets href to scheme + value
    // scheme: tel, mailto, wa (whatsapp), url (raw)
    document.querySelectorAll('[data-setting-href]').forEach(el => {
      const [path, scheme] = el.getAttribute('data-setting-href').split(':');
      const v = get(path);
      if (v === undefined) return;
      if (scheme === 'tel') el.href = 'tel:' + v.replace(/\D/g, '');
      else if (scheme === 'mailto') el.href = 'mailto:' + v;
      else if (scheme === 'wa') el.href = 'https://wa.me/' + v.replace(/\D/g, '');
      else el.href = v;
    });
  }).catch(() => { /* fail silently */ });
})();

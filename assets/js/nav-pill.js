// Liquid pill that follows the hovered nav link, resting on the active one.
// On pages with no active nav link, the pill stays hidden until hover.
(function () {
  const wrap = document.querySelector('.nav-links');
  if (!wrap) return;
  const pill = wrap.querySelector('.nav-pill');
  const links = wrap.querySelectorAll('a');
  if (!pill || !links.length) return;

  const active = wrap.querySelector('a.active'); // may be null on non-nav pages

  function setOn(el) {
    links.forEach(function (a) { a.classList.toggle('pill-on', a === el); });
  }
  function move(el) {
    if (!el) return;
    pill.style.width = el.offsetWidth + 'px';
    pill.style.transform = 'translate(' + el.offsetLeft + 'px, -50%)';
    setOn(el);
  }
  function show() { wrap.classList.add('ready'); }
  function hide() { wrap.classList.remove('ready'); setOn(null); }

  // initial state: rest on active link, or stay hidden
  if (active) requestAnimationFrame(function () { move(active); show(); });

  links.forEach(function (a) {
    a.addEventListener('mouseenter', function () { show(); move(a); });
  });
  wrap.addEventListener('mouseleave', function () {
    if (active) { move(active); } else { hide(); }
  });

  window.addEventListener('resize', function () { if (active) move(active); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (active) move(active); });
})();

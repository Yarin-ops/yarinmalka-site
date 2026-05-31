// Liquid pill that follows the hovered nav link.
// Hover-only: no resting state, so the menu looks identical on every page.
(function () {
  const wrap = document.querySelector('.nav-links');
  if (!wrap) return;
  const pill = wrap.querySelector('.nav-pill');
  const links = wrap.querySelectorAll('a');
  if (!pill || !links.length) return;

  function setOn(el) {
    links.forEach(function (a) { a.classList.toggle('pill-on', a === el); });
  }
  function move(el) {
    if (!el) return;
    pill.style.width = el.offsetWidth + 'px';
    pill.style.transform = 'translate(' + el.offsetLeft + 'px, -50%)';
    setOn(el);
  }

  links.forEach(function (a) {
    a.addEventListener('mouseenter', function () { wrap.classList.add('ready'); move(a); });
  });
  wrap.addEventListener('mouseleave', function () {
    wrap.classList.remove('ready');
    setOn(null);
  });
})();

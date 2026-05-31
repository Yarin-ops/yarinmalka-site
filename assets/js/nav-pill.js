// Liquid pill that follows the hovered nav link, resting on the active one.
(function () {
  const wrap = document.querySelector('.nav-links');
  if (!wrap) return;
  const pill = wrap.querySelector('.nav-pill');
  const links = wrap.querySelectorAll('a');
  if (!pill || !links.length) return;

  function move(el) {
    if (!el) return;
    pill.style.width = el.offsetWidth + 'px';
    pill.style.transform = 'translate(' + el.offsetLeft + 'px, -50%)';
  }
  function active() { return wrap.querySelector('a.active') || links[0]; }

  function init() { move(active()); wrap.classList.add('ready'); }
  requestAnimationFrame(init);

  links.forEach(function (a) { a.addEventListener('mouseenter', function () { move(a); }); });
  wrap.addEventListener('mouseleave', function () { move(active()); });
  window.addEventListener('resize', function () { move(active()); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { move(active()); });
})();

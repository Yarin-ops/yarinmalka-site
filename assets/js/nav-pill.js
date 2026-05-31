// Liquid pill that follows the hovered nav link with a directional elastic stretch.
// Hover-only: no resting state, so the menu looks identical on every page.
(function () {
  const wrap = document.querySelector('.nav-links');
  if (!wrap) return;
  const pill = wrap.querySelector('.nav-pill');
  const links = wrap.querySelectorAll('a');
  if (!pill || !links.length) return;

  let prev = null;       // previous left position
  let settleT = null;    // timer to relax the stretch

  function setOn(el) {
    links.forEach(function (a) { a.classList.toggle('pill-on', a === el); });
  }

  function move(el) {
    const left = el.offsetLeft;
    const w = el.offsetWidth;
    pill.style.width = w + 'px';

    if (prev === null) {
      // first appearance — no stretch, just place
      pill.style.transform = 'translate(' + left + 'px, -50%)';
    } else {
      // stretch toward the direction of travel, scaled by distance
      const dist = Math.abs(left - prev);
      const stretch = Math.min(1 + dist / 200, 1.45);
      pill.style.transformOrigin = (left > prev ? 'left' : 'right') + ' center';
      pill.style.transform = 'translate(' + left + 'px, -50%) scaleX(' + stretch + ')';
      clearTimeout(settleT);
      settleT = setTimeout(function () {
        pill.style.transform = 'translate(' + left + 'px, -50%) scaleX(1)';
      }, 190);
    }
    prev = left;
    setOn(el);
  }

  links.forEach(function (a) {
    a.addEventListener('mouseenter', function () { wrap.classList.add('ready'); move(a); });
  });
  wrap.addEventListener('mouseleave', function () {
    wrap.classList.remove('ready');
    setOn(null);
    prev = null;
    clearTimeout(settleT);
  });
})();

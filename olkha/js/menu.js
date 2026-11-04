/* Ольха — меню: подсветка текущего раздела в навигации, на телефоне вкладка сама прокручивается в поле зрения; печать */
(() => {
  'use strict';

  const nav = document.querySelector('[data-mnav]');
  const links = nav ? [...nav.querySelectorAll('a')] : [];
  const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (links.length && 'IntersectionObserver' in window) {
    const setActive = (id) => {
      links.forEach((a) => {
        const on = a.getAttribute('href') === `#${id}`;
        a.classList.toggle('is-active', on);
        if (on) {
          a.setAttribute('aria-current', 'true');
          if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - 20, behavior: 'smooth' });
        } else {
          a.removeAttribute('aria-current');
        }
      });
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-35% 0px -60% 0px' });
    sections.forEach((s) => io.observe(s));
  }

  const print = document.querySelector('[data-print]');
  if (print) print.addEventListener('click', () => window.print());
})();

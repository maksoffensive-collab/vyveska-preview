/* Ольха — общее для всех страниц: шапка, полноэкранное меню, появления, демо-окно */
(() => {
  'use strict';

  const html = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- шапка: прячется при прокрутке вниз, возвращается вверх ---------- */
  const header = document.querySelector('[data-header]');
  const dock = document.querySelector('[data-dock]');
  const footer = document.querySelector('.footer');
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    header.classList.toggle('is-solid', y > 24);
    if (!html.classList.contains('overlay-open')) header.classList.toggle('is-hidden', y > lastY && y > 320);
    lastY = y;
    if (dock && footer) dock.classList.toggle('is-away', footer.getBoundingClientRect().top < innerHeight * 0.55);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- полноэкранное меню ---------- */
  const burger = document.querySelector('[data-burger]');
  const overlay = document.querySelector('[data-overlay]');
  if (burger && overlay) {
    overlay.inert = true;
    const setOverlay = (open) => {
      html.classList.toggle('overlay-open', open);
      overlay.inert = !open;
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      html.style.overflow = open ? 'hidden' : '';
      if (open) header.classList.remove('is-hidden');
    };
    burger.addEventListener('click', () => setOverlay(!html.classList.contains('overlay-open')));
    overlay.addEventListener('click', (e) => { if (e.target.closest('a')) setOverlay(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && html.classList.contains('overlay-open')) { setOverlay(false); burger.focus(); } });
  }

  /* ---------- появления: блоки, строки заголовков, фото ---------- */
  document.querySelectorAll('[data-lines]').forEach((el) => {
    el.querySelectorAll('.line').forEach((line, i) => line.style.setProperty('--li', i));
  });
  const reveals = [...document.querySelectorAll('[data-reveal], [data-lines], [data-img]')];
  reveals.forEach((el) => {
    if (el.style.getPropertyValue('--d')) return;
    const group = [...el.parentElement.children].filter((c) => c.matches('[data-reveal], [data-lines], [data-img]'));
    el.style.setProperty('--d', `${Math.min(group.indexOf(el), 6) * 0.08}s`);
  });
  // фото открываем, когда картинка уже загружена и раскодирована, иначе шторка едет по пустой подложке.
  // Картинку под шторкой (clip-path) браузер считает невидимой и сам не грузит — поэтому грузим её сразу.
  const loaded = (el) => Promise.race([
    Promise.all([...el.querySelectorAll('img')].map((img) => {
      if (img.loading === 'lazy') img.loading = 'eager';
      if (img.complete && img.naturalWidth) return null;
      return img.decode ? img.decode().catch(() => {}) : new Promise((r) => { img.onload = img.onerror = r; });
    })),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        if (e.target.hasAttribute('data-img')) loaded(e.target).then(() => e.target.classList.add('is-in'));
        else e.target.classList.add('is-in');
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- демо-окно вместо мессенджеров ресторана ---------- */
  const modal = document.querySelector('[data-demo-modal]');
  if (document.body.hasAttribute('data-demo') && modal) {
    const title = modal.querySelector('.demo__title');
    let lastFocus = null;
    const close = () => { modal.hidden = true; html.style.overflow = ''; if (lastFocus) lastFocus.focus(); };
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-messenger]');
      if (link) {
        e.preventDefault();
        lastFocus = link;
        const name = link.dataset.messenger;
        title.innerHTML = name === 'телефон' ? 'Здесь начнётся <em>звонок</em> администратору'
          : name === 'почта' ? 'Здесь откроется <em>письмо</em> ресторану'
          : `Здесь откроется <em>${name}</em> ресторана`;
        modal.hidden = false;
        html.style.overflow = 'hidden';
        modal.querySelector('.btn').focus();
        return;
      }
      if (e.target.closest('[data-demo-close]')) close();
    });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
  }
})();

/* Ольха — общее для всех страниц: шапка, полноэкранное меню, появления, курсор,
   строка в навигации подвала (въезжает с направления мыши), демо-окно */
(() => {
  'use strict';

  const html = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

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
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- курсор (только мышь) ---------- */
  const cursor = document.querySelector('[data-cursor]');
  if (cursor && finePointer) {
    const label = cursor.querySelector('[data-cursor-label]');
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y, raf = 0;
    const move = () => {
      cx += (x - cx) * 0.22;
      cy += (y - cy) * 0.22;
      cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.3 ? requestAnimationFrame(move) : 0;
    };
    addEventListener('pointermove', (e) => {
      x = e.clientX; y = e.clientY;
      if (!raf) raf = requestAnimationFrame(move);
      const t = e.target.closest ? e.target : null;
      const view = t && t.closest('[data-cursor="view"]');
      cursor.classList.toggle('is-view', !!view);
      if (view) label.textContent = view.dataset.cursorLabel || 'Смотреть';
      cursor.classList.toggle('is-link', !view && !!(t && t.closest('a, button, label, select, [data-cursor="link"]')));
    }, { passive: true });
    document.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
    document.addEventListener('pointerenter', () => cursor.classList.remove('is-hidden'));
  }

  /* ---------- фото блюда идёт за курсором (главная и меню): строки [data-photo] внутри [data-dishes] ---------- */
  const float = document.querySelector('[data-float]');
  if (float && finePointer && !reduced) {
    const img = float.querySelector('img');
    let x = 0, y = 0, fx = 0, fy = 0, raf = 0, on = false;
    const tick = () => {
      const dx = x - fx;
      fx += (x - fx) * 0.14;
      fy += (y - fy) * 0.14;
      float.style.transform = `translate3d(${fx}px, ${fy}px, 0) rotate(${Math.max(-8, Math.min(8, dx * 0.04))}deg)`;
      raf = on || Math.abs(dx) > 0.5 ? requestAnimationFrame(tick) : 0;
    };
    const hide = () => { on = false; float.classList.remove('is-on'); };
    document.querySelectorAll('[data-dishes]').forEach((list) => {
      list.querySelectorAll('[data-photo]').forEach((dish) => {
        dish.addEventListener('pointerenter', (e) => {
          if (!on) { fx = x = e.clientX; fy = y = e.clientY; }
          img.src = dish.dataset.photo;
          on = true;
          float.classList.add('is-on');
          if (!raf) raf = requestAnimationFrame(tick);
        });
        dish.addEventListener('pointerleave', hide);
      });
      list.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; });
    });
    addEventListener('scroll', () => { if (on) hide(); }, { passive: true });
  }

  /* ---------- навигация подвала: строка въезжает с той стороны, откуда пришла мышь ---------- */
  if (finePointer && !reduced) {
    document.querySelectorAll('[data-bignav] .bignav__item').forEach((item) => {
      const run = item.querySelector('.bignav__run');
      const side = (e) => {
        const r = item.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2 ? -1 : 1;
      };
      const go = (from, to) => run.animate(
        [{ transform: `translateY(${from}%)` }, { transform: `translateY(${to}%)` }],
        { duration: 550, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
      );
      item.addEventListener('mouseenter', (e) => go(side(e) * 101, 0));
      item.addEventListener('mouseleave', (e) => go(0, side(e) * 101));
    });
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

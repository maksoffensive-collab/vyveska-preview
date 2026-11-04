/* Ольха — главная: «вечер за одну прокрутку».
   Часы в шапке идут 18:00 → 00:00, палитра меняется по сценам, подписи залов въезжают с направления мыши,
   в сцене 23:00 курсор (или палец) — свеча, которая проявляет освещённое фото. */
(() => {
  'use strict';

  const html = document.documentElement;
  const header = document.querySelector('[data-header]');
  const main = document.querySelector('[data-evening]');
  if (!main) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- палитры сцен (контраст текста проверен для каждой) ---------- */
  const PALETTES = {
    golden: { bg: '#eadbc2', fg: '#1f1712', muted: '#6e5e50', line: 'rgba(31, 23, 18, 0.16)', accent: '#a9431f', surface: '#e2d0b3' },
    dusk:   { bg: '#d9b08a', fg: '#1f1712', muted: '#5a4030', line: 'rgba(31, 23, 18, 0.2)', accent: '#8e3818', surface: '#cda27a' },
    dinner: { bg: '#6b3b2a', fg: '#efe6d6', muted: '#cfb49c', line: 'rgba(239, 230, 214, 0.18)', accent: '#f0a36a', surface: '#5a3022' },
    talk:   { bg: '#2e1d19', fg: '#efe6d6', muted: '#a89482', line: 'rgba(239, 230, 214, 0.14)', accent: '#e27d46', surface: '#3a2722' },
    night:  { bg: '#110d0b', fg: '#efe6d6', muted: '#8d7e70', line: 'rgba(239, 230, 214, 0.14)', accent: '#e27d46', surface: '#1c1613' },
  };
  const scenes = [...main.querySelectorAll('[data-scene]')];
  scenes.forEach((s) => s.removeAttribute('data-theme'));   // с JS цвет ведёт вся страница
  let current = '';
  const applyScene = (name) => {
    if (name === current) return;
    current = name;
    const p = PALETTES[name];
    for (const k in p) html.style.setProperty(`--${k}`, p[k]);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.bg);
  };

  /* ---------- часы, солнце, огонёк ---------- */
  const clock = header.querySelector('[data-clock]');
  const footer = document.querySelector('.footer');
  let lastMin = -1;
  const update = () => {
    const mid = innerHeight * 0.55;
    let active = scenes[0];
    for (const s of scenes) if (s.getBoundingClientRect().top <= mid) active = s;
    applyScene(active.dataset.scene);

    const end = footer.offsetTop - innerHeight * 0.4;
    const p = clamp(scrollY / Math.max(1, end));
    const minutes = Math.round((18 * 60 + p * 360) / 5) * 5;
    if (minutes !== lastMin) {
      lastMin = minutes;
      const h = Math.floor(minutes / 60) % 24, m = minutes % 60;
      clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      header.style.setProperty('--sun', clamp((minutes - 18 * 60) / 180).toFixed(3));
      header.style.setProperty('--flame', clamp((minutes - 21 * 60) / 30).toFixed(3));
    }
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
  if (!reduced) requestAnimationFrame(() => html.classList.add('evening'));

  /* ---------- даты в строке брони и в финальной сцене ---------- */
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const day = (offset) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return d; };
  const dateSelect = document.querySelector('[data-quick-date]');
  if (dateSelect) {
    dateSelect.innerHTML = Array.from({ length: 14 }, (_, i) => {
      const d = day(i);
      const label = i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
      return `<option value="${iso(d)}"${i === 0 ? ' selected' : ''}>${label}</option>`;
    }).join('');
  }
  const tomorrowLink = document.querySelector('[data-tomorrow-link]');
  if (tomorrowLink) {
    const t = day(1);
    const u = new URL(tomorrowLink.getAttribute('href'), location.href);   // адрес брони берём из ссылки (на WordPress он другой)
    u.search = `?date=${iso(t)}&time=19:30&guests=2`;
    tomorrowLink.href = u.href;
    tomorrowLink.textContent = `Забронировать на ${t.getDate()} ${MONTHS[t.getMonth()]}`;
  }

  /* ---------- 19:00: лёгкий параллакс полосы с огнём ---------- */
  const band = main.querySelector('.fire__band');
  if (band && !reduced) {
    const par = () => {
      const r = band.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      band.style.setProperty('--par', `${((r.top + r.height / 2 - innerHeight / 2) * -0.12).toFixed(1)}px`);
    };
    addEventListener('scroll', par, { passive: true });
    par();
  }

  /* ---------- 21:30: подпись зала въезжает с той стороны, откуда пришла мышь ---------- */
  if (finePointer && !reduced) {
    main.querySelectorAll('.hall-card').forEach((card) => {
      const cap = card.querySelector('.hall-card__cap');
      const edge = (e) => {
        const r = card.getBoundingClientRect();
        const dl = e.clientX - r.left, dr = r.right - e.clientX, dt = e.clientY - r.top, db = r.bottom - e.clientY;
        const m = Math.min(dl, dr, dt, db);
        return m === dl ? 'translate(-101%, 0)' : m === dr ? 'translate(101%, 0)' : m === dt ? 'translate(0, -280%)' : 'translate(0, 101%)';
      };
      const run = (from, to) => cap.animate([{ transform: from }, { transform: to }],
        { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
      card.addEventListener('mouseenter', (e) => run(edge(e), 'translate(0, 0)'));
      card.addEventListener('mouseleave', (e) => run('translate(0, 0)', edge(e)));
    });
  }

  /* ---------- 23:00: курсор-свеча ---------- */
  const candle = main.querySelector('[data-candle]');
  if (candle && !reduced) {
    const pic = candle.querySelector('.candle__pic');
    const hint = candle.querySelector('[data-candle-hint]');
    const mobile = () => innerWidth <= 720;
    const anchor = () => (mobile() ? [0.5, 0.4] : [0.47, 0.42]);   // где свечи на фото
    let tx = 0, ty = 0, cx = 0, cy = 0, lastMove = -1e9, visible = false, raf = 0;
    const toAnchor = () => { const r = pic.getBoundingClientRect(); const [ax, ay] = anchor(); tx = r.width * ax; ty = r.height * ay; };
    toAnchor(); cx = tx; cy = ty;

    const frame = (now) => {
      raf = 0;
      if (!visible) return;
      const r = pic.getBoundingClientRect();
      if (now - lastMove > 2200) {   // никто не ведёт свечу: свет медленно «дышит» над свечами
        const [ax, ay] = anchor();
        tx = r.width * ax + Math.sin(now / 1900) * r.width * 0.05;
        ty = r.height * ay + Math.cos(now / 2600) * r.height * 0.04;
      }
      cx = lerp(cx, tx, 0.09);
      cy = lerp(cy, ty, 0.09);
      const base = Math.min(320, Math.max(170, r.width * 0.2));
      const flick = 1 + Math.sin(now / 90) * 0.012 + Math.sin(now / 37) * 0.01 + Math.sin(now / 410) * 0.025;
      pic.style.setProperty('--x', `${cx.toFixed(1)}px`);
      pic.style.setProperty('--y', `${cy.toFixed(1)}px`);
      pic.style.setProperty('--r', `${(base * flick).toFixed(1)}px`);
      raf = requestAnimationFrame(frame);
    };
    const point = (clientX, clientY) => {
      const r = pic.getBoundingClientRect();
      tx = clientX - r.left; ty = clientY - r.top;
      lastMove = performance.now();
    };
    candle.addEventListener('pointermove', (e) => point(e.clientX, e.clientY));
    candle.addEventListener('touchmove', (e) => {
      point(e.touches[0].clientX, e.touches[0].clientY);
      if (hint) hint.style.opacity = '0';
    }, { passive: true });
    candle.addEventListener('touchstart', (e) => point(e.touches[0].clientX, e.touches[0].clientY), { passive: true });

    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      html.classList.toggle('candle-on', visible);
      if (visible && !raf) raf = requestAnimationFrame(frame);
    }, { threshold: 0.15 }).observe(candle);
    addEventListener('resize', toAnchor);
  }

  /* ---------- «живое фото» на первом экране ---------- */
  // Петля из рендера (6 с, ~1–2 МБ) грузится только после всей страницы и только если зритель не просил
  // экономить трафик или убрать движение; играет, пока первый экран виден, иначе стоит (бережём батарею телефона).
  const live = document.querySelector('[data-live]');
  const save = !!(navigator.connection && navigator.connection.saveData);
  if (live && !reduced && !save) {
    const start = () => {
      live.src = `${live.dataset.live}-${innerWidth <= 720 ? 720 : 1080}.mp4`;
      live.addEventListener('playing', () => live.classList.add('is-playing'), { once: true });
      let seen = true;
      new IntersectionObserver(([e]) => {
        seen = e.isIntersecting;
        if (seen) live.play().catch(() => {}); else live.pause();
      }, { threshold: 0.05 }).observe(live);
      if (seen) live.play().catch(() => {});
    };
    if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
  }
})();

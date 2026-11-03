/* «Ольха» — фильм-сайт: готовые кадры (рендер Blender) по прокрутке и всё, что поверх них.
   Прокрутка → время фильма t (100 = один экран) → кадр. Сценарий, подписи, меню — из film-test/story.js (FILM),
   экранные точки подписей по кадрам — из film-data.js (FILMSEQ), кадры показывает SeqPlayer (как у «Ганаша»).
   Фильм не обгоняет зрителя: даже при быстрой прокрутке идёт не быстрее MAX_RATE, чтобы подписи успевали читаться. */
(function () {
  'use strict';
  const F = window.FILM, S = window.FILMSEQ;
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (k) => k * k * (3 - 2 * k);
  const ramp = (t, a, b) => smooth(clamp((t - a) / (b - a)));
  const band = (t, a, b, fi = 10, fo = 10) => Math.min(ramp(t, a, a + fi), 1 - ramp(t, b - fo, b));
  const MAX_RATE = 40;

  // кадры для телефона — вертикальные, для компьютера — горизонтальные (выбираем один раз, по экрану)
  const CAM = innerWidth / innerHeight < 0.9 ? 'mob' : 'desk';
  // чёрный экран с «Ольхой», пока не загрузится каждый четвёртый кадр по всему фильму (плеер грузит от грубого
  // к точному, остальное докачает на ходу); прокрутка до этого закрыта, на очень медленной сети ждём не дольше 15 с
  const READY = Math.ceil(S.frames / 4), root = document.documentElement;
  let ready = false;
  const showFilm = () => {
    if (ready) return;
    ready = true;
    $('#loader').classList.add('is-gone');
    root.classList.remove('is-loading');
  };
  root.classList.add('is-loading');
  setTimeout(showFilm, 15000);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; // обновление — с начала фильма
  const canvas = $('#stage');
  const player = new SeqPlayer(canvas, {
    frames: S.frames,
    src: (i) => `film/seq/${CAM}/${String(i - 1).padStart(4, '0')}.webp`,
    frameWidth: CAM === 'mob' ? 720 : 1600, frameHeight: CAM === 'mob' ? 1280 : 900,
    fit: 'cover', background: '#0a0706', concurrency: 10,
    crossfade: true, // смешивание соседних кадров — не лишнее движение, и в режиме «уменьшить движение» тоже
    onProgress: (loaded, total, failed) => { if (loaded + failed >= READY) showFilm(); },
  });
  // в покадровой сцене соседние снимки не смешиваем — укусы появляются «щелчком»
  const stopK = (t) => { const s = F.STOP; return t < s.range[0] || t >= s.range[1] ? -1 : clamp(Math.floor((t - s.t0) / s.step) + 1, 0, s.frames); };
  function frameAt(t) {
    const f = t / S.step;
    return stopK(t) >= 0 ? Math.round(f) : f;
  }

  /* ---------- подписи ---------- */
  const caps = F.CAPTIONS.map((c) => {
    const el = document.createElement('div');
    el.className = 'cap ' + (c.at ? 'cap--pin' : 'cap--' + c.pos) + (c.cls ? ' cap--' + c.cls : '');
    el.innerHTML = (c.at ? '<i class="cap__dot"></i><i class="cap__line"></i>' : '') + '<div class="cap__box">' + c.html + '</div>';
    $('#caps').appendChild(el);
    return { c, el, box: el.querySelector('.cap__box'), line: el.querySelector('.cap__line'), w: 0, on: false };
  });
  // точка подписи в кадре f (дробном) — между соседними кадрами плавно
  function anchorAt(name, f) {
    const A = S[CAM][name];
    if (!A) return null;
    const i = f - A.f0, i0 = Math.floor(i), k = i - i0;
    const a = A.p[i0], b = A.p[i0 + 1];
    if (!a) return null;
    if (!b) return a;
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  }
  function updateCaps(t) {
    const vw = innerWidth, vh = innerHeight, sc = Math.min(1, vw / 1000), f = frameAt(t);
    for (const k of caps) {
      const { c, el } = k, a = band(t, c.t[0], c.t[1], 14, 14);
      if (a <= 0.001) { if (k.on) { el.style.visibility = 'hidden'; k.on = false; } continue; }
      if (!k.on) { el.style.visibility = 'visible'; k.on = true; }
      if (!c.at) { el.style.opacity = a; k.box.style.transform = `translateY(${(1 - a) * 16}px)`; continue; }
      const p = anchorAt(c.at, f);
      if (!p) { el.style.opacity = 0; continue; }
      const { x, y } = player.toScreen(p[0], p[1]);
      if (x < -40 || y < -40 || x > vw + 40 || y > vh + 40) { el.style.opacity = 0; continue; }
      let dx = (c.d ? c.d[0] : 40) * sc;
      const dy = (c.d ? c.d[1] : -50) * sc;
      if (!k.w) k.w = k.box.offsetWidth;
      if ((dx > 0 && x + dx + k.w > vw - 16) || (dx < 0 && x + dx - k.w < 16)) dx = -dx;
      const bx = dx < 0 ? x + dx - k.w : x + dx, shift = Math.max(0, 16 - bx) - Math.max(0, bx + k.w - (vw - 16));
      el.classList.toggle('is-left', dx < 0);
      el.style.opacity = a;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      k.line.style.width = Math.hypot(dx, dy) + 'px';
      k.line.style.transform = `rotate(${Math.atan2(dy, dx)}rad) scaleX(${smooth(clamp(a * 1.6))})`;
      k.box.style.transform = `translate(${dx + shift}px, ${dy}px) translate(${dx < 0 ? -100 : 0}%, ${dy < 0 ? -100 : 0}%)`;
      k.box.style.opacity = clamp(a * 2 - 0.6);
    }
  }

  /* ---------- шапка, полоса сцен, пояснения ---------- */
  const clockEl = $('#clock'), sceneEl = $('#scene'), progEl = $('#prog'), notesEl = $('#notes'), notesBtn = $('#notes-btn');
  F.SCENES.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.title = `${i + 1}. ${s.title}`; b.setAttribute('aria-label', `Сцена ${i + 1}: ${s.title}`);
    b.innerHTML = '<i></i>';
    b.addEventListener('click', () => jump(s.t[0] + 3));
    progEl.appendChild(b);
  });
  const segs = [...progEl.children];
  let curScene = -1;
  const sceneAt = (t) => F.SCENES.reduce((n, s, i) => (t >= s.t[0] ? i : n), 0);
  function renderNotes(i) {
    const s = F.SCENES[i];
    sceneEl.innerHTML = `<b>${i + 1}/${F.SCENES.length} · ${s.title}</b>${s.note.split('. ')[0]}.`;
    notesEl.innerHTML = `<p class="notes__k">Сцена ${i + 1} из ${F.SCENES.length}</p><h3>${s.title}</h3><p>${s.note}</p>` +
      (s.tech ? `<p class="notes__k">Приёмы съёмки</p><ul class="notes__tech">${s.tech.map(([n, d]) => `<li><b>${n}</b> — ${d}</li>`).join('')}</ul>` : '');
  }
  notesBtn.addEventListener('click', () => {
    const open = notesBtn.getAttribute('aria-expanded') !== 'true';
    notesBtn.setAttribute('aria-expanded', open);
    notesEl.classList.toggle('is-open', open);
  });
  function updateHud(t) {
    const i = sceneAt(t), s = F.SCENES[i];
    let pr = clamp((t - s.t[0]) / (s.t[1] - s.t[0]));
    if (s.steps) { const k = stopK(t); if (k >= 0) pr = k / s.steps; }
    const m = Math.round(lerp(s.clock[0], s.clock[1], pr)) % (24 * 60);
    const txt = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    if (clockEl.textContent !== txt) clockEl.textContent = txt;
    if (i !== curScene) { curScene = i; renderNotes(i); }
    segs.forEach((b, j) => { const sc = F.SCENES[j]; b.style.setProperty('--p', clamp((t - sc.t[0]) / (sc.t[1] - sc.t[0])).toFixed(3)); });
  }

  /* ---------- меню и приглашение поверх кадра ---------- */
  const menuEl = $('#menu'), bookEl = $('#book'), endEl = $('#end'), hintEl = $('#hint');
  {
    const tabs = $('#menu-tabs'), list = $('#menu-list');
    const render = (i) => {
      [...tabs.children].forEach((b, j) => b.setAttribute('aria-selected', i === j));
      list.innerHTML = F.MENU[i].dishes.map((d) =>
        `<li><button class="dish" type="button" aria-expanded="false"><span class="dish__name">${d[0]}</span>${d[4] ? `<span class="dish__tag">${d[4]}</span>` : ''}<span class="dish__plus" aria-hidden="true"></span></button>` +
        `<div class="dish__more"><div><p>${d[1]}</p><p class="dish__meta"><span>${d[2]}</span><b>${d[3]}</b></p></div></div></li>`).join('');
    };
    F.MENU.forEach((sec, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = sec.name;
      b.addEventListener('click', () => render(i));
      tabs.appendChild(b);
    });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('.dish');
      if (!b) return;
      const open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', open);
      b.parentElement.classList.toggle('is-open', open);
    });
    render(0);
  }
  {
    const date = $('#b-date'), time = $('#b-time'), guests = $('#b-guests'), go = $('#b-go');
    const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (let i = 1; i <= 14; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      date.add(new Option(`${i === 1 ? 'завтра' : DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`, iso(d)));
    }
    ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30'].forEach((v) => time.add(new Option(v, v, v === '19:30', v === '19:30')));
    for (let g = 1; g <= 8; g++) guests.add(new Option(g === 8 ? '8+' : String(g), g, g === 2, g === 2));
    const upd = () => (go.href = `bron.html?date=${date.value}&time=${time.value}&guests=${guests.value}`);
    [date, time, guests].forEach((s) => s.addEventListener('change', upd));
    upd();
  }
  $('#again').addEventListener('click', () => jump(0));
  function updateUi(t) {
    menuEl.classList.toggle('is-on', t >= F.MENU_T[0] && t <= F.MENU_T[1]);
    bookEl.classList.toggle('is-on', t >= F.BOOK_T[0] && t <= F.BOOK_T[1]);
    endEl.classList.toggle('is-on', t >= F.END_T);
    hintEl.classList.toggle('is-off', t > 20);
  }

  /* ---------- вспышки на склейках ---------- */
  const fadeEl = $('#fade');
  let jumpFade = 0;
  function updateFx(t, dt) {
    let k = 0, col = '0,0,0';
    for (const f of F.FLASHES) { const v = smooth(clamp(1 - Math.abs(t - f.t) / f.w)) * f.a; if (v > k) { k = v; col = f.color; } }
    jumpFade = Math.max(0, jumpFade - dt * 2.5);
    if (jumpFade > k) { k = jumpFade; col = '0,0,0'; }
    fadeEl.style.opacity = k.toFixed(3);
    fadeEl.style.background = `rgb(${col})`;
  }

  /* ---------- прокрутка → время ---------- */
  const scroller = $('#scroller');
  let unit = innerHeight, lastW = 0, tTarget = 0, tNow = 0;
  function layout() {
    unit = innerHeight;
    scroller.style.height = ((F.TOTAL / 100) * unit + innerHeight) + 'px';
  }
  function resize() {
    if (innerWidth !== lastW || Math.abs(innerHeight - unit) > 120) { lastW = innerWidth; layout(); scrollTo(0, (tTarget / 100) * unit); }
  }
  addEventListener('resize', resize);
  addEventListener('scroll', () => { tTarget = clamp((scrollY / unit) * 100, 0, F.TOTAL); }, { passive: true });
  function jump(t) {
    jumpFade = 1;
    scrollTo({ top: (t / 100) * unit, behavior: 'instant' });
    tTarget = tNow = t;
  }
  F.seek = jump;
  F.player = player;

  layout();
  const q = Number(new URLSearchParams(location.search).get('t'));
  if (q > 0) jump(clamp(q, 0, F.TOTAL)); else tTarget = tNow = clamp((scrollY / unit) * 100, 0, F.TOTAL);
  jumpFade = 0;
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const diff = tTarget - tNow, cap = MAX_RATE * dt * (Math.abs(diff) > 600 ? 5 : 1);
    tNow += clamp(diff * (1 - Math.exp(-dt * 5)), -cap, cap);
    if (Math.abs(tTarget - tNow) < 0.01) tNow = tTarget;
    const t = tNow;
    player.setProgress(frameAt(t) / (S.frames - 1));
    updateCaps(t);
    updateHud(t);
    updateUi(t);
    updateFx(t, dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();

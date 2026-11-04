/* «Ольха» — фильм-сайт: видео из рендера Blender, показ «главами», и всё, что поверх кадра.
   Одна прокрутка (колесо, свайп, клавиша) — фильм плавно трогается, доезжает до следующей подписи и замирает;
   подпись висит, пока зритель не листнёт дальше. Назад — то же по обратному ролику (видео не умеет играть задом).
   Время фильма t (как в превизе, 0…TOTAL) = кадр × step; сценарий, подписи, меню — film-test/story.js (FILM),
   экранные точки подписей по кадрам — film-data.js (FILMSEQ). */
(function () {
  'use strict';
  const F = window.FILM, S = window.FILMSEQ;
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (k) => k * k * (3 - 2 * k);
  const ramp = (t, a, b) => smooth(clamp((t - a) / (b - a)));
  const band = (t, a, b, fi = 10, fo = 10) => Math.min(ramp(t, a, a + fi), 1 - ramp(t, b - fo, b));
  const RATE = 45;                       // скорость фильма: единиц t в секунду видео
  const FPS = S.fps || RATE / S.step;    // кадров в секунду видео
  const EASE_IN = 0.8, EASE_OUT = 0.9;   // разгон после остановки и торможение перед подписью, с
  const LINGER = 0.9;                    // листнули во время движения — на следующей подписи постоять столько, потом дальше

  // ролик для телефона — вертикальный, для компьютера — горизонтальный (выбираем один раз, по экрану)
  const CAM = innerWidth / innerHeight < 0.9 ? 'mob' : 'desk';
  const VW = CAM === 'mob' ? 720 : 1600, VH = CAM === 'mob' ? 1280 : 900;
  const root = document.documentElement;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const vf = $('#vf'), vr = $('#vr');
  // H.264 понимают все браузеры; ключевой кадр раз в 2 с и сильное сжатие — 17 МБ на ПК, 10 МБ на телефоне
  const ext = '.mp4';
  vf.poster = `film/video/${CAM}.jpg`;   // первый кадр — сразу, пока видео в пути
  vf.src = `film/video/${CAM}${ext}`;
  // обратный ролик (для прокрутки назад) качаем не сразу, чтобы не отнимать скорость у прямого: когда прямой докачан
  // или через 6 с после старта; если листнули назад раньше — переход затемнением и загрузка. При «экономии трафика» не качаем
  let revLoading = false;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const loadRev = () => { if (!revLoading && !saveData) { revLoading = true; vr.preload = 'auto'; vr.src = `film/video/${CAM}_rev${ext}`; vr.load(); } };
  const bufferedTo = (v) => { let e = 0; for (let i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= v.currentTime + 1) e = Math.max(e, v.buffered.end(i)); return e; };
  vf.addEventListener('progress', () => { if (vf.duration && bufferedTo(vf) >= vf.duration - 0.5) loadRev(); });

  // чёрный экран с «Ольхой» — только пока не пришло начало фильма до первой главы (пара мегабайт), остальное
  // докачивается, пока зритель смотрит; на очень медленной сети ждём не дольше 12 с
  let ready = false, NEED = 6;
  const showFilm = () => {
    if (ready) return;
    ready = true;
    $('#loader').classList.add('is-gone');
    root.classList.remove('is-loading');
    setTimeout(loadRev, 6000);  // браузер может и не докачивать прямой ролик до конца — не ждём этого вечно
  };
  root.classList.add('is-loading');
  const check = () => { if (vf.readyState >= 3 && bufferedTo(vf) >= Math.min(NEED, (vf.duration || 99) - 0.1)) showFilm(); };
  ['progress', 'canplay', 'canplaythrough', 'loadeddata'].forEach((e) => vf.addEventListener(e, check));
  setTimeout(showFilm, 12000);
  // iPhone не грузит видео, пока его не «запустили»: беззвучный короткий пуск разрешён и будит загрузку
  vf.play().then(() => { if (!play) { vf.pause(); vf.currentTime = fwdTime(tStill); } }).catch(() => {});

  // кадр ↔ время: середина кадра, чтобы не попадать на границу и не показывать соседний
  const D1 = (S.frames - 1) / FPS;
  const fwdTime = (t) => clamp(t / S.step, 0, S.frames - 1) / FPS + 0.5 / FPS;
  const revTime = (t) => D1 - clamp(t / S.step, 0, S.frames - 1) / FPS + 0.5 / FPS;
  let active = vf;
  const tOf = () => (active === vf ? (vf.currentTime - 0.5 / FPS) * RATE : (D1 - vr.currentTime + 0.5 / FPS) * RATE);
  // точка кадра (доли от левого верхнего угла) → экран: ролик вписан как object-fit: cover по центру
  function toScreen(nx, ny) {
    const k = Math.max(innerWidth / VW, innerHeight / VH);
    return { x: (innerWidth - VW * k) / 2 + nx * VW * k, y: (innerHeight - VH * k) / 2 + ny * VH * k };
  }

  /* ---------- остановки: на каждой подписи, на меню, на приглашении, в финале ---------- */
  const STOPS = (() => {
    const s = [0];
    for (const c of F.CAPTIONS) {
      if (c.t[1] <= 30) continue;
      let at = c.t[0] + Math.min(30, (c.t[1] - c.t[0]) * 0.4);
      if (c.at && S[CAM][c.at]) {
        // подпись со стрелкой: встаём, когда её точка уже в кадре (у телефона и компьютера кадр разный)
        const A = S[CAM][c.at];
        for (let t = c.t[0] + 18; t <= c.t[1] - 24; t += S.step) {
          const p = A.p[Math.round(t / S.step) - A.f0];
          if (p && p[0] > 0.04 && p[0] < 0.96 && p[1] > 0.02 && p[1] < 0.95) { at = Math.max(at, t + 8); break; }
        }
        at = Math.min(at, c.t[1] - 24);
      }
      s.push(at);
    }
    s.push(F.MENU_T[0] + 40, F.BOOK_T[0] + 40, Math.min(F.END_T + 40, F.TOTAL - 4));
    s.sort((a, b) => a - b);
    const out = [];
    for (const v of s) { if (out.length && v - out[out.length - 1] < 28) out[out.length - 1] = v; else out.push(v); }
    return out;
  })();
  const stopAt = (t) => STOPS.reduce((n, s, i) => (s <= t + 0.5 ? i : n), 0);
  NEED = STOPS[1] / RATE + 1.5;  // для старта хватит видео до первой главы с запасом

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
    const vw = innerWidth, vh = innerHeight, sc = Math.min(1, vw / 1000), f = t / S.step;
    for (const k of caps) {
      const { c, el } = k, a = band(t, c.t[0], c.t[1], 14, 14);
      if (a <= 0.001) { if (k.on) { el.style.visibility = 'hidden'; k.on = false; } continue; }
      if (!k.on) { el.style.visibility = 'visible'; k.on = true; }
      if (!c.at) { el.style.opacity = a; k.box.style.transform = `translateY(${(1 - a) * 16}px)`; continue; }
      const p = anchorAt(c.at, f);
      if (!p) { el.style.opacity = 0; continue; }
      let { x, y } = toScreen(p[0], p[1]);
      // предмет за краем кадра (вертикальный кадр телефона уже) — подпись прижимаем к краю, а не прячем
      x = clamp(x, 28, vw - 28); y = clamp(y, 90, vh - 110);
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
  const stopK = (t) => { const s = F.STOP; return t < s.range[0] || t >= s.range[1] ? -1 : clamp(Math.floor((t - s.t0) / s.step) + 1, 0, s.frames); };
  const clockEl = $('#clock'), sceneEl = $('#scene'), progEl = $('#prog'), notesEl = $('#notes'), notesBtn = $('#notes-btn');
  F.SCENES.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.title = `${i + 1}. ${s.title}`; b.setAttribute('aria-label', `Сцена ${i + 1}: ${s.title}`);
    b.innerHTML = '<i></i>';
    b.addEventListener('click', () => jump(STOPS.find((v) => v >= s.t[0]) ?? s.t[0]));  // первая глава сцены
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

  /* ---------- главы: проигрывание до следующей остановки ---------- */
  let at = 0;                 // индекс остановки, на которой стоим (или от которой едем)
  let play = null;            // { dir, target, t0 (время старта), more (листнули ещё раз) }
  let tStill = 0;             // t, пока стоим
  let busy = false;           // переключение роликов (ждём перемотку)

  const seek = (v, time) => new Promise((res) => {
    if (Math.abs(v.currentTime - time) < 0.25 / FPS) return res();
    v.addEventListener('seeked', () => res(), { once: true });
    v.currentTime = time;
  });
  function show(v) {
    active = v;
    vf.classList.toggle('is-on', v === vf);
    vr.classList.toggle('is-on', v === vr);
  }
  async function start(dir) {
    const cur = play ? tOf() : tStill;
    const next = dir > 0 ? STOPS.findIndex((s) => s > cur + 1) : (() => { let k = -1; STOPS.forEach((s, i) => { if (s < cur - 1) k = i; }); return k; })();
    if (next < 0) return;
    const v = dir > 0 ? vf : vr;
    if (dir < 0 && vr.readyState < 2) { loadRev(); return jump(STOPS[next]); } // обратный ролик ещё не пришёл — переход затемнением
    if (active !== v || !play) {
      busy = true;
      if (active !== v) { (play ? active : null)?.pause(); await seek(v, dir > 0 ? fwdTime(cur) : revTime(cur)); }
      show(v); busy = false;
    }
    play = { dir, target: next, t0: performance.now(), more: false, rate: 0.15 };
    v.playbackRate = play.rate;
    v.play().catch(() => jump(STOPS[next]));
  }
  function arrive() {
    const v = active, T = STOPS[play.target], more = play.more, dir = play.dir;
    v.pause();
    at = play.target; tStill = T; play = null;
    // встаём точно на кадр остановки, а для следующего «вперёд» держим прямой ролик в том же месте
    seek(v, v === vf ? fwdTime(T) : revTime(T)).then(() => {
      if (v === vr) seek(vf, fwdTime(T)).then(() => { if (!play) show(vf); });
    });
    if (more) setTimeout(() => { if (!play) start(dir); }, LINGER * 1000);
  }
  function gesture(dir) {
    if (!ready || busy) return;
    if (play && play.dir === dir) { play.more = true; return; }   // листнули ещё раз — после подписи поедем дальше
    start(dir);
  }
  function jump(t) {
    if (play) { active.pause(); play = null; }
    jumpFade = 1;
    tStill = t; at = stopAt(t);
    show(vf);
    vf.currentTime = fwdTime(t);
  }
  F.seek = jump;

  // скорость ролика: плавный разгон после остановки и торможение у подписи
  function steer(now) {
    if (!play || busy) return;
    const t = tOf(), T = STOPS[play.target];
    const left = (play.dir > 0 ? T - t : t - T) / RATE;          // секунд видео до остановки
    if (left <= 0.4 / FPS) return arrive();
    const kin = smooth(clamp((now - play.t0) / 1000 / EASE_IN));
    const kout = clamp(left / EASE_OUT, 0.22, 1);
    const r = Math.round(clamp(Math.min(0.15 + 0.85 * kin, kout), 0.15, 1) * 20) / 20;  // шаг 0.05 — без лишних смен
    if (r !== play.rate) { play.rate = r; active.playbackRate = r; }
  }

  /* ---------- ввод: колесо, свайп, клавиши ---------- */
  let wheelAcc = 0, wheelLast = 0, wheelFired = false;
  addEventListener('wheel', (e) => {
    if (e.ctrlKey) return;              // масштаб страницы
    e.preventDefault();
    const now = performance.now();
    if (now - wheelLast > 220) { wheelAcc = 0; wheelFired = false; }  // пауза — значит, новый жест (инерция тачпада — тот же)
    wheelLast = now;
    wheelAcc += e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    if (!wheelFired && Math.abs(wheelAcc) > 30) { wheelFired = true; gesture(Math.sign(wheelAcc)); }
  }, { passive: false });
  let touchY = null;
  addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchmove', (e) => { if (!e.target.closest('.panel, .notes, .end, select')) e.preventDefault(); }, { passive: false });
  addEventListener('touchend', (e) => {
    if (touchY === null) return;
    const dy = touchY - e.changedTouches[0].clientY; touchY = null;
    if (Math.abs(dy) > 36) gesture(Math.sign(dy));
  });
  addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); gesture(1); }
    else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); gesture(-1); }
    else if (e.key === 'Home') jump(0);
    else if (e.key === 'End') jump(STOPS[STOPS.length - 1]);
  });

  const q = Number(new URLSearchParams(location.search).get('t'));
  if (q > 0) jump(clamp(q, 0, F.TOTAL)); else { tStill = 0; vf.currentTime = fwdTime(0); }
  jumpFade = 0;
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    steer(now);
    const t = play ? tOf() : tStill;
    updateCaps(t);
    updateHud(t);
    updateUi(t);
    updateFx(t, dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();

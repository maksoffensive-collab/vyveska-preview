/* Ганаш — интерфейс страницы: шапка, меню, появление блоков, подписи на срезе торта, демо-окно */
(() => {
  'use strict';

  const html = document.documentElement;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- шапка ---------- */
  const header = document.querySelector('[data-header]');
  const lightSections = [...document.querySelectorAll('[data-theme="light"]')];
  function updateHeader() {
    const y = header.offsetHeight / 2;
    header.classList.toggle('is-scrolled', scrollY > 40);
    header.classList.toggle('is-light', lightSections.some((s) => {
      const r = s.getBoundingClientRect();
      return r.top <= y && r.bottom > y;
    }));
  }
  addEventListener('scroll', updateHeader, { passive: true });
  addEventListener('resize', updateHeader);
  updateHeader();

  /* ---------- меню на телефоне ---------- */
  const burger = document.querySelector('[data-burger]');
  const nav = document.querySelector('[data-nav]');
  const setMenu = (open) => {
    html.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Меню');
  };
  burger.addEventListener('click', () => setMenu(!html.classList.contains('menu-open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- появление блоков ---------- */
  const reveals = [...document.querySelectorAll('[data-reveal]')];
  reveals.forEach((el) => {
    const siblings = [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal'));
    el.style.setProperty('--d', `${Math.min(siblings.indexOf(el), 6) * 0.09}s`);
  });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- первый экран: кадры из Blender по прокрутке ---------- */
  const hero = document.querySelector('[data-hero]');
  const canvas = hero && hero.querySelector('[data-seq]');
  if (hero && canvas && window.SeqPlayer && window.SEQ) {
    const SEQ = window.SEQ;
    const N = SEQ.frames;
    const A = SEQ.acts;
    const poster = hero.querySelector('[data-poster]');
    const brand = hero.querySelector('[data-brand]');
    const hint = hero.querySelector('[data-hint]');
    const loader = hero.querySelector('[data-loader]');
    const anatomy = hero.querySelector('[data-anatomy]');
    const head = hero.querySelector('[data-anatomy-head]');
    const svg = hero.querySelector('[data-lines]');
    const callouts = [...hero.querySelectorAll('[data-layer]')];
    const caption = hero.querySelector('[data-caption]');
    const SVGNS = 'http://www.w3.org/2000/svg';
    const ORDER = ['berries', 'crumb', 'pastry', 'cream'];   // сверху вниз по куску

    // плавное появление/исчезновение на отрезке кадров a→b (появление), c→d (уход)
    const window4 = (f, a, b, c, d) => (f <= a || f >= d ? 0 : f < b ? smooth((f - a) / (b - a)) : f <= c ? 1 : 1 - smooth((f - c) / (d - c)));

    // номера для телефона: в подписи и на метке
    callouts.forEach((el) => {
      const n = document.createElement('i');
      n.className = 'callout__num';
      n.textContent = ORDER.indexOf(el.dataset.layer) + 1;
      el.prepend(n);
    });
    const marks = callouts.map((el) => {
      const path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('pathLength', '1');
      path.style.strokeDasharray = '1';
      const ring = document.createElementNS(SVGNS, 'circle');
      ring.setAttribute('class', 'ring');
      const dot = document.createElementNS(SVGNS, 'circle');
      dot.setAttribute('class', 'dot');
      const num = document.createElementNS(SVGNS, 'text');
      num.setAttribute('class', 'num');
      num.textContent = ORDER.indexOf(el.dataset.layer) + 1;
      svg.append(path, ring, dot, num);
      return { path, ring, dot, num };
    });

    let mode = '', player = null, sizes = null, calloutW = 260;

    // точка якоря в кадре f (дробном) — линейно между соседними кадрами
    const anchorAt = (key, f) => {
      const arr = SEQ.anchors[mode] && SEQ.anchors[mode][key];
      if (!arr) return null;
      const i = Math.min(N - 1, Math.max(0, f - 1));
      const i0 = Math.floor(i), i1 = Math.min(N - 1, i0 + 1), t = i - i0;
      const a = arr[i0], b = arr[i1];
      if (!a || !b) return a || b;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    };

    const measure = () => {
      sizes = {
        callout: callouts.map((c) => c.offsetHeight),
        name: callouts.map((c) => c.querySelector('b').offsetHeight),
        head: head.offsetHeight,
      };
    };

    const setup = () => {
      const m = innerWidth / innerHeight < 0.9 ? 'mob' : 'desk';
      if (m === mode && player) return;
      mode = m;
      if (player) player.destroy();
      html.classList.remove('seq-ready');
      anatomy.classList.toggle('is-mobile', m === 'mob');
      calloutW = 260;
      anatomy.style.setProperty('--callout-w', m === 'mob' ? `${(innerWidth - 56) / 2}px` : '260px');
      poster.src = `seq/${m}/0001.webp`;
      player = new SeqPlayer(canvas, {
        frames: window.SEQ.images || N,   // картинок может быть больше, чем кадров истории — плавнее
        src: (i) => `seq/${m}/${String(i).padStart(4, '0')}.webp`,
        frameWidth: m === 'desk' ? 1920 : 1080,
        frameHeight: m === 'desk' ? 1080 : 1920,
        background: '#0d0907',
        onFirstFrame: () => html.classList.add('seq-ready'),
        onProgress: (loaded, total, failed) => {
          loader.style.transform = `scaleX(${(loaded + failed) / total})`;
          loader.classList.toggle('is-done', loaded + failed >= total);
        },
      });
      measure();
      render(cur);
    };

    // ----- подписи слоёв (второе действие)
    const layoutCallouts = (f, t) => {
      const W = canvas.clientWidth, Hh = canvas.clientHeight;
      const pts = {};
      for (const key of ORDER) {
        const a = anchorAt(key, f);
        if (a) pts[key] = player.toScreen(a[0], a[1]);
      }
      const items = callouts.map((el, i) => ({ el, i, key: el.dataset.layer, p: pts[el.dataset.layer] })).filter((it) => it.p);
      if (mode === 'mob') {
        // номера на срезе, подписи сеткой в две колонки у нижнего края
        const pad = 20, gap = 16, cw = (W - pad * 2 - gap) / 2;
        const rows = Math.ceil(items.length / 2);
        const rowH = Math.max(...sizes.callout) + 12;
        let y0 = Hh - pad - rows * rowH - 8;
        items.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key)).forEach((it, k) => {
          const tk = smooth(seg(t, k * 0.1, k * 0.1 + 0.5));
          const x = pad + (k % 2) * (cw + gap), y = y0 + Math.floor(k / 2) * rowH;
          it.el.style.opacity = tk;
          it.el.style.transform = `translate3d(${x}px, ${y + (1 - tk) * 10}px, 0)`;
          const m = marks[it.i];
          m.path.style.opacity = 0;
          for (const c of [m.ring, m.dot]) { c.setAttribute('cx', it.p.x.toFixed(1)); c.setAttribute('cy', it.p.y.toFixed(1)); }
          m.dot.setAttribute('r', '9'); m.ring.setAttribute('r', '14');
          m.num.setAttribute('x', it.p.x.toFixed(1)); m.num.setAttribute('y', (it.p.y + 0.5).toFixed(1));
          m.dot.style.opacity = smooth(seg(tk, 0, 0.4));
          m.num.style.opacity = smooth(seg(tk, 0.1, 0.5));
          m.ring.style.opacity = smooth(seg(tk, 0.1, 0.5)) * 0.7;
        });
        head.style.transform = `translate3d(${pad}px, ${Math.max(96, y0 - sizes.head - 22)}px, 0)`;
        head.style.opacity = smooth(seg(t, 0, 0.5));
        return;
      }
      // компьютер: колонка подписей сбоку от куска, линии к слоям
      const xs = items.map((it) => it.p.x);
      const pad = Math.max(28, W * 0.04);
      // подписи — слева от куска: справа стоит сам торт. В узком окне колонка уже
      // левая граница куска — точка на краю (крошка снаружи), а не середина среза
      const ec = anchorAt('coat', f);
      const edgeX = Math.min(...xs, ec ? player.toScreen(ec[0], ec[1]).x - 10 : Infinity);
      const room = edgeX - pad;
      const side = room >= 230 ? -1 : 1;
      const cw = side < 0 ? Math.round(Math.max(180, Math.min(260, room - 50))) : 260;
      if (cw !== calloutW) {
        calloutW = cw;
        anatomy.style.setProperty('--callout-w', `${cw}px`);
        measure();
      }
      const gapX = side < 0 ? Math.min(60, room - cw) : 90;
      let colX = side > 0 ? Math.max(...xs) + gapX : edgeX - gapX - cw;
      colX = Math.max(pad, Math.min(W - pad - cw, colX));
      items.sort((a, b) => a.p.y - b.p.y);
      const hs = items.map((it) => sizes.callout[it.i]);
      const ys = items.map((it) => it.p.y);
      const gap = 18;
      for (let k = 1; k < ys.length; k++) ys[k] = Math.max(ys[k], ys[k - 1] + (hs[k - 1] + hs[k]) / 2 + gap);
      const meanA = items.reduce((s2, it) => s2 + it.p.y, 0) / items.length;
      const meanY = ys.reduce((s2, y) => s2 + y, 0) / ys.length;
      let shift = meanA - meanY;
      const top = Math.max(120, sizes.head + 140);
      if (ys[0] + shift - hs[0] / 2 < top) shift = top - ys[0] + hs[0] / 2;
      const bottom = Hh - 60;
      const lastB = ys[ys.length - 1] + shift + hs[hs.length - 1] / 2;
      if (lastB > bottom) shift -= lastB - bottom;
      items.forEach((it, k) => {
        const tk = smooth(seg(t, k * 0.12, k * 0.12 + 0.45));
        const ly = ys[k] + shift - hs[k] / 2;
        it.el.style.opacity = tk;
        it.el.style.textAlign = side > 0 ? 'left' : 'right';
        it.el.style.transform = `translate3d(${colX + (1 - tk) * 14 * side}px, ${ly}px, 0)`;
        const m = marks[it.i];
        const ex = side > 0 ? colX - 14 : colX + cw + 14;
        const ey = ly + sizes.name[it.i] / 2;
        const dx = (ex - it.p.x) * 0.5;
        m.path.setAttribute('d', `M${it.p.x.toFixed(1)} ${it.p.y.toFixed(1)} C${(it.p.x + dx).toFixed(1)} ${it.p.y.toFixed(1)} ${(ex - dx).toFixed(1)} ${ey.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
        m.path.style.opacity = 1;
        m.path.style.strokeDashoffset = String(1 - smooth(seg(tk, 0, 0.8)));
        for (const c of [m.ring, m.dot]) { c.setAttribute('cx', it.p.x.toFixed(1)); c.setAttribute('cy', it.p.y.toFixed(1)); }
        m.dot.setAttribute('r', '2.8'); m.ring.setAttribute('r', '7.5');
        m.num.style.opacity = 0;
        m.dot.style.opacity = smooth(seg(tk, 0, 0.3));
        m.ring.style.opacity = smooth(seg(tk, 0.1, 0.5)) * 0.9;
      });
      const hx = side > 0 ? colX : colX + cw - head.offsetWidth;
      head.style.transform = `translate3d(${hx}px, ${ys[0] + shift - hs[0] / 2 - sizes.head - 26}px, 0)`;
      head.style.opacity = smooth(seg(t, 0, 0.5));
    };

    const hideCallouts = () => {
      callouts.forEach((el) => { el.style.opacity = 0; });
      marks.forEach((m) => { m.path.style.opacity = 0; m.ring.style.opacity = 0; m.dot.style.opacity = 0; m.num.style.opacity = 0; });
      head.style.opacity = 0;
    };

    // ----- кадр + все наложения
    const render = (p) => {
      if (!player) return;
      player.setProgress(p);
      const f = 1 + p * (N - 1);
      brand.style.opacity = window4(f, A.write[1] - 16, A.write[1] - 4, A.move[0] + 2, A.move[0] + 12);
      hint.style.opacity = 1 - smooth(seg(f, 1.2, 5));
      const tL = window4(f, A.labels[0] - 8, A.labels[0] + 6, A.labels[1] - 2, A.labels[1] + 6);
      if (tL > 0) {
        anatomy.dataset.on = '1';
        layoutCallouts(f, tL);
      } else if (anatomy.dataset.on) {
        delete anatomy.dataset.on;
        hideCallouts();
      }
      const tc = window4(f, A.zerog[0] + 8, A.zerog[0] + 22, N + 50, N + 60);
      caption.style.opacity = tc;
      caption.style.transform = mode === 'mob' ? `translate3d(0, ${(1 - tc) * 16}px, 0)` : `translate3d(0, calc(-50% + ${(1 - tc) * 16}px), 0)`;
      caption.classList.toggle('is-active', tc > 0.6);
    };

    // ----- прокрутка → прогресс (с мягким сглаживанием)
    let target = 0, cur = 0, raf = 0, last = 0;
    const read = () => {
      const r = hero.getBoundingClientRect();
      const total = hero.offsetHeight - innerHeight;
      target = total > 0 ? clamp(-r.top / total) : 0;
    };
    const tick = (now) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      cur += (target - cur) * (1 - Math.exp(-dt * 10));
      if (Math.abs(target - cur) < 0.00015) cur = target;
      render(cur);
      if (cur !== target) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    };
    addEventListener('scroll', () => { read(); kick(); }, { passive: true });
    addEventListener('resize', () => { setup(); measure(); read(); kick(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); render(cur); });
    read();
    cur = target;
    setup();
  }

  /* ---------- демо-окно вместо чужих мессенджеров ---------- */
  const modal = document.querySelector('[data-demo-modal]');
  if (document.body.hasAttribute('data-demo') && modal) {
    const title = modal.querySelector('.demo__title');
    let lastFocus = null;
    const close = () => {
      modal.hidden = true;
      html.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    };
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-messenger]');
      if (link) {
        e.preventDefault();
        lastFocus = link;
        const name = link.dataset.messenger;
        title.innerHTML = name === 'телефон'
          ? 'Здесь начнётся <em>звонок</em> кондитеру'
          : `Здесь откроется <em>${name}</em> кондитера`;
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

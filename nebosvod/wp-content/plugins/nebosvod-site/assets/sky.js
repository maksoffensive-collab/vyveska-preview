/* Небосвод: небо на фоне сайта. Без библиотек.
   - Млечный Путь: свой canvas, рисуется один раз (и при смене размера окна): полоса по диагонали, тёплое ядро,
     тёмные прожилки (пин заказчика 2, ref/12). При прокрутке вниз он ярче — «вечер темнеет» (site.css)
   - звёзды: canvas за содержимым, 2 слоя, мерцание яркостью; не чаще 30 кадров/с; пауза на скрытой вкладке.
     Небо одно и то же на всех страницах: случайность с постоянным зерном
   - луна: серп с пепельным светом и «вечерняя звезда» рядом (снимок ESO, ref/12). Стоит на первом экране
     и при прокрутке уходит вверх медленнее страницы (site.css)
   - падающие звёзды: при входе нового блока в экран и сами по себе раз в 9–16 с; не чаще раза в 4,5 с,
     не больше 14 за визит. Бывают короткие тусклые, обычные и редкие яркие, иногда парой; луну не пересекают
   - prefers-reduced-motion или «экономия трафика»: неподвижный кадр, без падающих звёзд */
(() => {
  const mk = (cls) => { const c = document.createElement('canvas'); c.className = cls; c.setAttribute('aria-hidden', 'true'); return c; };
  const mw = mk('sky-mw'), cv = mk('sky');
  document.body.prepend(mw, cv);
  const ctx = cv.getContext('2d'), mctx = mw.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || (navigator.connection && navigator.connection.saveData);
  const params = new URLSearchParams(location.search);
  let W = 0, H = 0, dpr = 1, stars = [], meteors = [], shown = 0, last = -1e9, raf = 0, frames = 0, mwMs = 0;

  // случайность с зерном (mulberry32): одинаковое небо на каждой странице
  const seeded = (s) => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rnd = (a, b) => a + Math.random() * (b - a);

  // луна: серп, пепельный свет диска, тёмные «моря», ореол; рядом вечерняя звезда — звезда из логотипа
  const moon = document.createElement('div');
  moon.className = 'nb-moon';
  moon.setAttribute('aria-hidden', 'true');
  moon.innerHTML = '<svg viewBox="0 0 70 70"><defs>'
    + '<radialGradient id="nbm-h"><stop offset=".27" stop-color="#E9D3A2" stop-opacity=".26"/><stop offset=".45" stop-color="#E9D3A2" stop-opacity=".09"/><stop offset="1" stop-color="#E9D3A2" stop-opacity="0"/></radialGradient>'
    + '<radialGradient id="nbm-e" cx=".34" cy=".66" r=".8"><stop offset="0" stop-color="#3E4468"/><stop offset="1" stop-color="#292E4E"/></radialGradient>'
    + '<linearGradient id="nbm-c" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FFF8EA"/><stop offset="1" stop-color="#EBD3A0"/></linearGradient>'
    + '<filter id="nbm-b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".45"/></filter>'
    + '<filter id="nbm-s"><feGaussianBlur stdDeviation=".7"/></filter>'
    + '<filter id="nbm-g" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.6"/></filter>'
    + '<mask id="nbm-m" maskUnits="userSpaceOnUse" x="0" y="0" width="70" height="70"><circle cx="35" cy="35" r="10" fill="#fff"/><circle cx="37.3" cy="32.4" r="10.25" fill="#000" filter="url(#nbm-b)"/></mask>'
    + '</defs><circle cx="35" cy="35" r="35" fill="url(#nbm-h)"/><circle cx="35" cy="35" r="10" fill="url(#nbm-e)"/>'
    + '<g fill="#1C2140" opacity=".22" filter="url(#nbm-s)"><ellipse cx="37.6" cy="31.4" rx="3.3" ry="2.2" transform="rotate(-25 37.6 31.4)"/><ellipse cx="33.6" cy="34.4" rx="2" ry="1.5"/><ellipse cx="38.6" cy="37.6" rx="1.8" ry="1.3"/></g>'
    + '<g filter="url(#nbm-g)" opacity=".85"><circle cx="35" cy="35" r="10" fill="#FFE7B8" mask="url(#nbm-m)"/></g>'
    + '<circle cx="35" cy="35" r="10" fill="url(#nbm-c)" mask="url(#nbm-m)"/></svg>'
    + '<i class="nb-moon__star"><svg viewBox="12 3 16 16"><path d="M20 3 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z"/></svg></i>';
  cv.after(moon);

  // луна не заходит за текст и фото первого экрана (на телефоне и планшете заголовки и подписи во всю ширину).
  // Задевает — ставим её меньше в промежуток между шапкой и первым текстом, а нет места — на этой странице прячем
  // Всё в координатах страницы: так верно, даже если страницу открыли уже прокрученной
  function placeMoon() {
    moon.style.cssText = ''; moon.classList.remove('nb-moon--gap');
    const sy = scrollY, hd = document.getElementById('masthead'), demo = document.querySelector('.nb-demo'), boxes = [];
    const top = Math.max(hd ? hd.offsetTop + hd.offsetHeight : 0, demo ? demo.getBoundingClientRect().bottom + sy : 0); // шапка и полоска «демо»
    const add = (r) => { const t = r.top + sy, b = r.bottom + sy; if (r.width && r.height && b > top && t < innerHeight) boxes.push({ l: r.left, r: r.right, t, b }); };
    document.querySelectorAll('h1, h2, p, li, .nb-word, .wp-block-button__link, img, iframe, form').forEach((el) => {
      if (el.closest('#masthead, .nb-demo')) return;
      if (/^(IMG|IFRAME|FORM)$/.test(el.tagName)) return add(el.getBoundingClientRect());
      const rg = document.createRange(); rg.selectNodeContents(el);
      for (const r of rg.getClientRects()) add(r);                // строки текста, а не весь блок
    });
    const R = moon.offsetWidth / 7, cx = moon.offsetLeft + moon.offsetWidth / 2, cy = moon.offsetTop + moon.offsetHeight / 2;
    const hit = (y, rad) => boxes.some((b) => cx + rad + 10 > b.l && cx - rad - 10 < b.r && y + rad + 10 > b.t && y - rad - 10 < b.b);
    const under = cy - R < top + 6;                                // залезла под шапку или полоску «демо»
    // звезда стоит над луной: если она ушла под шапку или полоску — ставим её сбоку, луну не двигаем
    if (moon.offsetTop + moon.offsetHeight * 0.24 - 10 < top) moon.classList.add('nb-moon--gap');
    if (!boxes.length || (!under && !hit(cy, R))) return;
    const gap = Math.min(...boxes.map((b) => b.t)) - top, r2 = Math.min(R, (gap - 20) / 2);
    if (r2 < 9 || hit(top + gap / 2, r2)) { moon.style.display = 'none'; return; }
    const sz = r2 * 7;
    moon.style.cssText = `top:${top + gap / 2 - sz / 2}px;width:${sz}px;height:${sz}px;right:${document.documentElement.clientWidth - cx - sz / 2}px`;
    moon.classList.add('nb-moon--gap');                            // звезду — левее луны, а не над ней (там шапка)
  }
  placeMoon();
  if (document.fonts) document.fonts.ready.then(placeMoon);

  // Млечный Путь: из левого верхнего угла в правый нижний; луна справа вверху остаётся в тёмном небе
  function milkyWay() {
    const q = Math.min(dpr, 1.5), c = mctx, r = seeded(1717);
    mw.width = W * q; mw.height = H * q;
    c.setTransform(q, 0, 0, q, 0, 0);
    // шум со сглаживанием: сгустки и рваные края (одинаковые на всех страницах)
    const lat = Float32Array.from({ length: 4096 }, r);
    const vn = (x, y) => {
      const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
      const p = (a, b) => lat[((b & 63) << 6) | (a & 63)], A = p(i, j), B = p(i + 1, j), C = p(i, j + 1), D = p(i + 1, j + 1);
      return A + (B - A) * su + (C - A) * sv + (A - B - C + D) * su * sv;
    };
    const fbm = (x, y) => vn(x, y) * 0.57 + vn(x * 2.1 + 5, y * 2.1) * 0.29 + vn(x * 4.3 + 9, y * 4.3) * 0.14;
    const mob = W < 760;
    const ax = -0.12 * W, ay = (mob ? 0.06 : -0.02) * H, dx = 1.24 * W, dy = (mob ? 0.9 : 1.08) * H;
    const L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const w = Math.max(120, Math.min(300, 0.12 * (W + H)));        // ширина полосы
    const warm = (t) => Math.exp(-(((t - 0.56) / 0.2) ** 2));      // тёплое ядро ближе к середине
    // яркость полосы (I) и тёмные прожилки (dust) в точке; t — вдоль полосы 0…1, d — поперёк, px
    const field = (x, y) => {
      const t = ((x - ax) * ux + (y - ay) * uy) / L, d = (y - ay) * ux - (x - ax) * uy;
      if (Math.abs(d) > w * 1.25) return null;                    // далеко от полосы — там пусто, не считаем
      const k = warm(t);
      const wn = w * (0.78 + 0.4 * fbm(t * 5, 1.5));
      const I = Math.exp(-((d / (wn * 0.42)) ** 2)) * (0.2 + 0.8 * fbm(t * 9, d / w * 2.4)) * (0.45 + 0.55 * k);
      const c1 = Math.sin(t * 10) * w * 0.07 + w * 0.05 + (fbm(t * 16, 3) - 0.5) * w * 0.08;
      const c2 = Math.sin(t * 7 + 2.1) * w * 0.07 - w * 0.07 + (fbm(t * 13, 7) - 0.5) * w * 0.08;
      const br = fbm(t * 26, 11);                                  // нити рвутся
      const dust = Math.max(Math.exp(-(((d - c1) / (w * (0.03 + 0.04 * br))) ** 2)), 0.45 * Math.exp(-(((d - c2) / (w * 0.035)) ** 2)))
        * Math.min(1, Math.max(0, br * 1.8 - 0.35)) * (0.35 + 0.65 * k);
      return [I * (1 - 0.6 * dust), dust, k];
    };
    // 1. свечение: считаем по точкам в 1/4 размера и растягиваем (наложение градиентов давало сетку)
    const lw = Math.ceil(W / 4), lh = Math.ceil(H / 4), lr = document.createElement('canvas');
    lr.width = lw; lr.height = lh;
    const lc = lr.getContext('2d'), img = lc.createImageData(lw, lh), px = img.data;
    for (let j = 0, o = 0; j < lh; j++) {
      for (let i = 0; i < lw; i++, o += 4) {
        const f = field(i * 4 + 2, j * 4 + 2);
        if (!f) continue;
        const [I, , k] = f;
        px[o] = 150 + 88 * k; px[o + 1] = 160 + 38 * k; px[o + 2] = 215 - 60 * k;
        px[o + 3] = I * 150 + Math.random();                         // случайный сдвиг на полтона — без полос
      }
    }
    lc.putImageData(img, 0, 0);
    c.clearRect(0, 0, W, H);
    c.imageSmoothingQuality = 'high';
    c.drawImage(lr, 0, 0, W, H);
    // 2. звёздная пыль: гуще к оси, в прожилках гаснет
    const g = () => (r() + r() + r() + r() - 2) / 2;
    const n = Math.round(L * w * (mob ? 0.013 : 0.011));
    for (let i = 0; i < n; i++) {
      const t = r(), dd = g() * w * 0.46, x = ax + dx * t - uy * dd, y = ay + dy * t + ux * dd, [I, dust, k] = field(x, y);
      const a = (0.06 + r() * 0.24) * (0.45 + I) * (1 - 0.7 * dust);
      if (a < 0.02) continue;
      c.fillStyle = `rgba(${r() < 0.25 + 0.45 * k ? '248,228,198' : '222,228,248'},${a.toFixed(3)})`;
      const s = r() < 0.92 ? 0.7 : 1.2;
      c.fillRect(x, y, s, s);
    }
  }

  function build() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth || innerWidth; H = cv.clientHeight || innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = seeded(42), rr = (a, b) => a + r() * (b - a);
    const n = Math.min(260, Math.round(W * H / 6500));
    stars = [];
    for (let i = 0; i < n; i++) {
      const near = r() < 0.18;                                     // ближний слой: крупнее и теплее
      stars.push({
        x: r() * W, y: r() * H,
        r: near ? rr(0.9, 1.6) : rr(0.35, 0.85),
        a: near ? rr(0.55, 0.95) : rr(0.25, 0.6),
        tw: rr(0.4, 1.4), ph: r() * 6.28,                          // скорость и фаза мерцания
        c: near && r() < 0.45 ? '233,211,162' : '246,240,228',
      });
    }
    // Млечный Путь — после загрузки, когда браузер свободен (на медленном телефоне это около 0,05 с), и плавно проявляется
    mw.classList.remove('on');
    (window.requestIdleCallback || ((f) => setTimeout(f, 60)))(() => {
      const t0 = performance.now();
      milkyWay();
      mwMs = performance.now() - t0;
      mw.classList.add('on');
    }, { timeout: 900 });
  }

  // падающие звёзды: доля, след, путь (px), длительность (мс), толщина, яркость
  const KINDS = [
    { p: 0.3, len: [60, 110], dist: [150, 240], dur: 650, lw: 1, a: 0.6 },    // короткая тусклая
    { p: 0.85, len: [120, 220], dist: [260, 420], dur: 900, lw: 1.4, a: 0.9 }, // обычная
    { p: 1, len: [230, 330], dist: [420, 560], dur: 1250, lw: 2, a: 1 },      // яркая, редкая
  ];
  const MAX = 14, GAP = 4500;

  function spawn(kind, t0, near) {
    const sc = Math.max(0.6, Math.min(1, W / 1100));                // на телефоне след короче
    const mr = moon.getBoundingClientRect(), mx = mr.left + mr.width / 2, my = mr.top + mr.height / 2, keep = mr.width * 0.33;
    for (let i = 0; i < 8; i++) {
      const fromLeft = near ? near.dir > 0 : Math.random() < 0.5;
      const ang = near ? near.ang : rnd(0.28, 0.55);
      const x = near ? near.x + rnd(-90, 90) : fromLeft ? rnd(0.05, 0.45) * W : rnd(0.55, 0.95) * W;
      const y = near ? near.y + rnd(30, 90) : rnd(0.04, 0.35) * H;
      const dir = fromLeft ? 1 : -1, len = rnd(...kind.len) * sc, dist = rnd(...kind.dist) * sc;
      const ex = x + dir * Math.cos(ang) * dist, ey = y + Math.sin(ang) * dist;
      // не пролетать по луне: расстояние от её центра до пути
      const vx = ex - x + dir * Math.cos(ang) * len, vy = ey - y + Math.sin(ang) * len;
      const sx = x - dir * Math.cos(ang) * len, sy = y - Math.sin(ang) * len;
      const u = Math.max(0, Math.min(1, ((mx - sx) * vx + (my - sy) * vy) / (vx * vx + vy * vy)));
      if (mr.bottom > 0 && Math.hypot(sx + vx * u - mx, sy + vy * u - my) < keep) continue;
      const m = { x, y, dir, ang, len, dist, t0, dur: kind.dur, lw: kind.lw, a: kind.a };
      meteors.push(m);
      return m;
    }
    return null;
  }

  function meteor(force) {
    const now = performance.now();
    if (still || (!force && (shown >= MAX || now - last < GAP))) return;
    last = now; shown++;
    const x = Math.random(), kind = force === 'bright' ? KINDS[2] : force === 'normal' ? KINDS[1] : KINDS.find((k) => x < k.p);
    const m = spawn(kind, now);
    if (m && (force === 'pair' || (!force && Math.random() < 0.2))) spawn(KINDS[Math.random() < 0.5 ? 0 : 1], now + rnd(280, 600), m);
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const k = still ? 1 : 0.65 + 0.35 * Math.sin(t / 1000 * s.tw + s.ph);
      ctx.fillStyle = `rgba(${s.c},${(s.a * k).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
    meteors = meteors.filter((m) => {
      const p = (t - m.t0) / m.dur;
      if (p < 0) return true;                                      // вторая из пары ещё не вылетела
      if (p >= 1) return false;
      const e = 1 - Math.pow(1 - p, 3);                            // плавное торможение
      const cx = Math.cos(m.ang), sy = Math.sin(m.ang);
      const x = m.x + m.dir * cx * m.dist * e, y = m.y + sy * m.dist * e;
      const tx = x - m.dir * cx * m.len, ty = y - sy * m.len;
      const fade = (p < 0.15 ? p / 0.15 : 1 - Math.max(0, (p - 0.6) / 0.4)) * m.a;
      const g = ctx.createLinearGradient(tx, ty, x, y);
      g.addColorStop(0, 'rgba(233,211,162,0)');
      g.addColorStop(1, `rgba(255,248,232,${fade.toFixed(3)})`);
      ctx.strokeStyle = g; ctx.lineWidth = m.lw; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      if (m.lw > 1.5) {                                            // у яркой — тёплое свечение головы
        const h = ctx.createRadialGradient(x, y, 0, x, y, 7);
        h.addColorStop(0, `rgba(255,236,200,${(0.5 * fade).toFixed(3)})`); h.addColorStop(1, 'rgba(255,236,200,0)');
        ctx.fillStyle = h; ctx.fillRect(x - 7, y - 7, 14, 14);
      }
      ctx.fillStyle = `rgba(255,250,240,${fade.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, m.lw + 0.2, 0, 6.283); ctx.fill();
      return true;
    });
  }

  let prev = 0;
  function loop(t) {
    raf = 0;
    if (document.hidden) return;                                   // вкладка скрыта — спим
    if (t - prev >= 33) { prev = t; draw(t); frames++; }            // не чаще 30 кадров/с
    raf = requestAnimationFrame(loop);
  }

  build();
  if (still) { draw(0); frames = 1; }
  else { raf = requestAnimationFrame(loop); }
  // на телефоне высота окна меняется, когда прячется адресная строка; canvas высотой 100lvh — перерисовка только при настоящей смене размера
  addEventListener('resize', () => {
    if (cv.clientWidth === W && cv.clientHeight === H) return;
    build(); placeMoon(); if (still) draw(0);
  }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !still && !raf) raf = requestAnimationFrame(loop); });

  if (!still) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) meteor(); }), { threshold: 0.35 });
    document.querySelectorAll('[data-sky], .nb-sec, .nb-foot, .entry-content > .wp-block-group').forEach((el) => io.observe(el));
    setTimeout(meteor, 2000);                                      // первая — над первым экраном
    const idle = () => setTimeout(() => { if (!document.hidden) meteor(); if (shown < MAX) idle(); }, rnd(9000, 16000));
    idle();                                                        // и сами по себе, пока гость читает
  }
  // для проверки: ?meteor=now | bright | pair — сразу запустить падающую звезду
  const test = params.get('meteor');
  if (test) setTimeout(() => meteor(test === 'now' ? 'normal' : test), 300);
  window.__sky = { frames: () => frames, meteors: () => shown, flying: () => meteors.length, mwMs: () => Math.round(mwMs), still: !!still };
})();

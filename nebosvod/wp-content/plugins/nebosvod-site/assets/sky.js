/* Небосвод: звёзды на фоне и падающая звезда. Без библиотек.
   - canvas за содержимым, 2 слоя звёзд, мерцание яркостью; не чаще 30 кадров/с; пауза на скрытой вкладке
   - падающая звезда при входе нового блока [data-sky] в экран: не чаще раза в 8 с и не больше 5 за визит
   - prefers-reduced-motion или «экономия трафика»: один неподвижный кадр, без падающих звёзд */
(() => {
  const cv = document.createElement('canvas');
  cv.className = 'sky';
  cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);
  const ctx = cv.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || (navigator.connection && navigator.connection.saveData);
  const params = new URLSearchParams(location.search);
  let W = 0, H = 0, dpr = 1, stars = [], meteors = [], shown = 0, last = -1e9, raf = 0, frames = 0;

  const rnd = (a, b) => a + Math.random() * (b - a);
  function build() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(260, Math.round(W * H / 6500));
    stars = [];
    for (let i = 0; i < n; i++) {
      const near = Math.random() < 0.18;               // ближний слой: крупнее и теплее
      stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: near ? rnd(0.9, 1.6) : rnd(0.35, 0.85),
        a: near ? rnd(0.55, 0.95) : rnd(0.25, 0.6),
        tw: rnd(0.4, 1.4), ph: Math.random() * 6.28,     // скорость и фаза мерцания
        c: near && Math.random() < 0.45 ? '233,211,162' : '246,240,228',
      });
    }
  }

  function meteor() {
    const now = performance.now();
    if (still || shown >= 5 || now - last < 8000) return;
    last = now; shown++;
    const fromLeft = Math.random() < 0.5;
    meteors.push({
      x: fromLeft ? rnd(0.05, 0.45) * W : rnd(0.55, 0.95) * W, y: rnd(0.04, 0.35) * H,
      ang: (fromLeft ? 1 : -1) * rnd(0.28, 0.55), len: rnd(120, 220), dist: rnd(260, 420), t0: now, dur: 900,
    });
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
      if (p >= 1) return false;
      const e = 1 - Math.pow(1 - p, 3);                 // плавное торможение
      const dir = m.ang > 0 ? 1 : -1;
      const x = m.x + dir * Math.cos(Math.abs(m.ang)) * m.dist * e;
      const y = m.y + Math.sin(Math.abs(m.ang)) * m.dist * e;
      const tx = x - dir * Math.cos(Math.abs(m.ang)) * m.len, ty = y - Math.sin(Math.abs(m.ang)) * m.len;
      const fade = p < 0.15 ? p / 0.15 : 1 - Math.max(0, (p - 0.6) / 0.4);
      const g = ctx.createLinearGradient(tx, ty, x, y);
      g.addColorStop(0, 'rgba(233,211,162,0)');
      g.addColorStop(1, `rgba(255,248,232,${(0.9 * fade).toFixed(3)})`);
      ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = `rgba(255,250,240,${fade.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 6.283); ctx.fill();
      return true;
    });
  }

  let prev = 0;
  function loop(t) {
    raf = 0;
    if (document.hidden) return;                         // вкладка скрыта — спим
    if (t - prev >= 33) { prev = t; draw(t); frames++; }  // не чаще 30 кадров/с
    raf = requestAnimationFrame(loop);
  }

  build();
  if (still) { draw(0); frames = 1; }
  else { raf = requestAnimationFrame(loop); }
  addEventListener('resize', () => { build(); if (still) draw(0); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !still && !raf) raf = requestAnimationFrame(loop); });

  if (!still) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) meteor(); }), { threshold: 0.35 });
    document.querySelectorAll('[data-sky], .nb-sec, .nb-foot, .entry-content > .wp-block-group').forEach((el) => io.observe(el));
    setTimeout(meteor, 2000);                             // первая — над первым экраном
  }
  // для проверки: ?meteor=now — сразу запустить одну падающую звезду
  if (params.get('meteor') === 'now') { last = -1e9; setTimeout(() => { last = -1e9; meteor(); }, 300); }
  window.__sky = { frames: () => frames, meteors: () => shown, still: !!still };
})();

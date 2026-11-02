/* ============ Вывеска — анимации и интерактив ============ */
(() => {
  const root = document.documentElement;
  const $ = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];

  const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (!hasGsap) root.classList.remove('js');
  const animate = hasGsap && root.classList.contains('js');
  const canHover = matchMedia('(hover: hover)').matches;

  /* ---------- Навигация: фон после начала прокрутки ---------- */
  const nav = $('[data-nav]');
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Переключатель «С поддержкой / Под ключ» ---------- */
  const tiers = $('[data-tiers]');
  const switchBtns = $$('[data-switch] button');
  const setMode = (mode) => {
    if (tiers.dataset.mode === mode) return;
    tiers.dataset.mode = mode;
    switchBtns.forEach((b) => b.setAttribute('aria-checked', b.dataset.mode === mode));
    $$('[data-price]').forEach((el, i) => {
      const swap = () => {
        $('.price__value', el).textContent = el.dataset[mode];
        $('.price__note', el).textContent = el.dataset[mode + 'Note'];
      };
      if (!animate) return swap();
      gsap.timeline({ delay: i * 0.06 })
        .to(el, { y: -14, opacity: 0, duration: 0.2, ease: 'power2.in' })
        .call(swap)
        .fromTo(el, { y: 14 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
    });
  };
  switchBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  /* ---------- Подсветка плиток за курсором ---------- */
  $$('[data-glow]').forEach((grid) =>
    grid.addEventListener('pointermove', (e) =>
      $$('.tile', grid).forEach((t) => {
        const r = t.getBoundingClientRect();
        t.style.setProperty('--x', `${e.clientX - r.left}px`);
        t.style.setProperty('--y', `${e.clientY - r.top}px`);
      })
    )
  );

  /* ---------- Вывеска: разбиваем на неоновые «трубки» ---------- */
  const signText = $('[data-sign]');
  const signReflection = $('[data-sign-reflection]');
  const word = signText.textContent.trim();
  signText.textContent = '';
  signReflection.textContent = '';
  const tubes = [...word].map((ch) => {
    const a = document.createElement('span');
    a.className = 'tube';
    a.textContent = ch;
    const b = a.cloneNode(true);
    signText.append(a);
    signReflection.append(b);
    return [a, b];
  });

  if (!animate) return;

  /* ================= дальше — только с анимациями ================= */
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // Мигание неона: on/off по шаблону, в конце — включено
  const setOn = (els, on) => els.forEach((el) => el.classList.toggle('is-off', !on));
  const flicker = (tl, els, at, pattern = [[0, 1], [0.05, 0], [0.1, 1], [0.17, 0], [0.32, 1]]) =>
    pattern.forEach(([d, on]) => tl.call(setOn, [els, !!on], at + d));

  /* ---------- 1. Вывеска загорается ---------- */
  const hero = $('[data-hero]');
  tubes.forEach((pair) => setOn(pair, false));

  const intro = gsap.timeline({ delay: 0.5 });
  tubes.forEach((pair, i) => flicker(intro, pair, i * 0.11 + gsap.utils.random(0, 0.18)));
  intro
    .to(hero, { '--lit': 1, duration: 1.6, ease: 'power2.out' }, 0.5)
    .to('[data-hero-in]', { opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: 'power3.out' }, 0.9);

  // Одна «трубка» иногда барахлит — как у настоящей вывески
  const broken = tubes[5];
  const glitch = () => {
    const tl = gsap.timeline({ onComplete: () => gsap.delayedCall(gsap.utils.random(3, 7), glitch) });
    flicker(tl, broken, 0, [[0, 0], [0.07, 1], [0.12, 0], [0.24, 1]]);
  };
  gsap.delayedCall(4, glitch);

  // Свет за курсором и уход hero при прокрутке
  if (canHover) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', `${e.clientX - r.left}px`);
      hero.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }
  gsap.to('.hero__inner', {
    yPercent: 14, opacity: 0.15, ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
  });

  /* ---------- 2. Бегущая строка ускоряется от скролла ---------- */
  const loop = gsap.to('[data-marquee]', { xPercent: -50, ease: 'none', duration: 32, repeat: -1 });
  ScrollTrigger.create({
    onUpdate: (self) => {
      const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 350, 6);
      gsap.to(loop, {
        timeScale: boost, duration: 0.2, overwrite: true,
        onComplete: () => gsap.to(loop, { timeScale: 1, duration: 1.2, ease: 'power2.out' }),
      });
    },
  });

  /* ---------- 3. Манифест: слова проявляются по одному ---------- */
  const manifest = $('[data-words]');
  [...manifest.childNodes].forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      // делим только по обычным пробелам — неразрывные (&nbsp;) остаются внутри слова
      node.textContent.split(/([ \t\n\r]+)/).forEach((part) => {
        if (!part) return;
        if (/^[ \t\n\r]+$/.test(part)) return frag.append(' ');
        const w = document.createElement('span');
        w.className = 'w';
        w.textContent = part;
        frag.append(w);
      });
      node.replaceWith(frag);
    } else {
      node.classList.add('w');
    }
  });
  const words = $$('.w', manifest);
  const alarm = $('[data-alarm]');
  const alarmAt = (words.indexOf(alarm) + 1) / words.length;

  const mm = gsap.matchMedia();
  mm.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)' }, (ctx) => {
    const { desktop } = ctx.conditions;
    gsap.fromTo(words, { opacity: 0.12 }, {
      opacity: 1, stagger: 0.1, ease: 'none',
      scrollTrigger: {
        trigger: '[data-manifest]',
        start: desktop ? 'top top' : 'top 75%',
        end: desktop ? '+=140%' : 'bottom 45%',
        pin: desktop,
        scrub: true,
        onUpdate: (self) => alarm.classList.toggle('is-lit', self.progress >= alarmAt * 0.98),
      },
    });
  });

  /* ---------- 4. Витрины ---------- */
  const shops = $$('[data-shop]');
  shops.forEach((s) => s.classList.add('is-off'));

  mm.add('(min-width: 1024px)', () => {
    const track = $('[data-track]');
    const distance = () => Math.max(0, track.scrollWidth - root.clientWidth);

    // Едем вдоль улицы
    gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: tiers,
        start: 'top top',
        end: () => `+=${Math.max(distance(), innerHeight * 0.6)}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

    // Свет в витринах включается по очереди
    const lights = gsap.timeline({ paused: true });
    shops.forEach((s, i) => flicker(lights, [s], 0.15 + i * 0.35));
    ScrollTrigger.create({
      trigger: tiers,
      start: 'top 55%',
      onEnter: () => lights.restart(),
      onLeaveBack: () => { lights.pause(0); setOn(shops, false); },
    });
  });

  mm.add('(max-width: 1023px)', () => {
    shops.forEach((s) => {
      const tl = gsap.timeline({ paused: true });
      flicker(tl, [s], 0);
      ScrollTrigger.create({
        trigger: s,
        start: 'top 75%',
        onEnter: () => tl.restart(),
        onLeaveBack: () => { tl.pause(0); setOn([s], false); },
      });
    });
  });

  /* ---------- 6. Процесс: неоновая линия и шаги ---------- */
  gsap.to('[data-beam]', {
    scaleY: 1, ease: 'none',
    scrollTrigger: { trigger: '[data-steps]', start: 'top 62%', end: 'bottom 62%', scrub: true },
  });
  $$('[data-step]').forEach((step) => {
    step.classList.add('is-off');
    ScrollTrigger.create({
      trigger: step,
      start: 'top 62%',
      onEnter: () => step.classList.remove('is-off'),
      onLeaveBack: () => step.classList.add('is-off'),
    });
  });

  /* ---------- Плавное появление блоков ---------- */
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' }),
  });

  /* ---------- 9. Табличка ЗАКРЫТО → ОТКРЫТО ---------- */
  const door = gsap.timeline({
    paused: true,
    defaults: { overwrite: 'auto' },
  });
  door
    .to('[data-door-card]', { rotationY: 180, duration: 1.2, ease: 'back.out(1.7)' })
    .fromTo('[data-door]', { rotation: 7 }, { rotation: 0, duration: 2, ease: 'elastic.out(1, 0.25)' }, 0.15)
    .to('[data-open]', { '--lit': 1, duration: 1.2, ease: 'power2.out' }, 0.35);
  ScrollTrigger.create({
    trigger: '[data-open]',
    start: 'top 45%',
    onEnter: () => door.play(),
    onLeaveBack: () => door.reverse(),
  });

  /* ---------- Магнитные кнопки ---------- */
  if (canHover) {
    $$('[data-magnetic]').forEach((btn) => {
      const xTo = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3' });
      const yTo = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3' });
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.3);
        yTo((e.clientY - r.top - r.height / 2) * 0.4);
      });
      btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  // После загрузки шрифтов размеры меняются — пересчитываем триггеры
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
})();

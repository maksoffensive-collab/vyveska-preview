/* Небосвод: форма брони. Выходные дни, прошедшее время сегодня, кнопки − / +, маска телефона, подсказка «это банкет».
   Схема зала: выбор стола по числу гостей, фото зоны и вида из окна (inc/tables.php). */
(() => {
  document.querySelectorAll('form.nb-book').forEach((f) => {
    const hours = JSON.parse(f.dataset.hours || '[]');
    const today = f.dataset.today, now = f.dataset.now;
    const date = f.querySelector('[name="nb_date"]');
    const hint = f.querySelector('.nb-slots__hint');
    const slots = [...f.querySelectorAll('.nb-slot input')];
    const guests = f.querySelector('[name="nb_guests"]');
    const big = f.querySelector('.nb-guests__big');
    const phone = f.querySelector('[name="nb_phone"]');
    if (!date) return; // превью схемы в админке — без даты и времени

    // по умолчанию — сегодня; если на сегодня время кончилось, ставим завтра
    const iso = (d) => d.toISOString().slice(0, 10);
    const close = (h) => { const p = (h || '').split(/\s*[–—-]\s*/); return p[1] || ''; };
    function update() {
      const v = date.value;
      if (!v) { slots.forEach((s) => (s.disabled = true)); hint.hidden = false; return; }
      const d = new Date(v + 'T12:00:00');
      const dow = (d.getDay() + 6) % 7;
      const h = hours[dow] || '';
      const closed = !h || h === '-';
      const end = close(h);
      let free = 0;
      slots.forEach((s) => {
        const t = s.value;
        const off = closed || (v === today && t <= now) || (end && end > '06:00' && t > end);
        s.disabled = off;
        if (off && s.checked) s.checked = false;
        if (!off) free++;
      });
      hint.hidden = !closed && free > 0;
      hint.textContent = closed ? f.dataset.msgClosed : f.dataset.msgNoslots;
    }
    if (date && !date.value) {
      date.value = today;
      update();
      if (!slots.some((s) => !s.disabled)) {
        const t = new Date(today + 'T12:00:00'); t.setDate(t.getDate() + 1); date.value = iso(t);
      }
    }
    date && date.addEventListener('change', update);
    update();

    // гости − / +
    f.querySelectorAll('.nb-guests__btn').forEach((b) => b.addEventListener('click', () => {
      const max = +guests.max || 8, v = Math.min(max, Math.max(1, (+guests.value || 1) + +b.dataset.d));
      guests.value = v;
      guests.dispatchEvent(new Event('input')); // схема зала пересчитает, какие столы подходят
      if (big) big.hidden = v < max;
    }));
    guests && guests.addEventListener('input', () => { if (big) big.hidden = +guests.value < +guests.max; });

    // маска телефона: +7 900 000-00-00
    phone && phone.addEventListener('input', () => {
      let d = phone.value.replace(/\D/g, '');
      if (d[0] === '8') d = '7' + d.slice(1);
      if (d[0] !== '7') d = '7' + d;
      d = d.slice(0, 11);
      const p = d.slice(1);
      let out = '+7';
      if (p.length) out += ' ' + p.slice(0, 3);
      if (p.length > 3) out += ' ' + p.slice(3, 6);
      if (p.length > 6) out += '-' + p.slice(6, 8);
      if (p.length > 8) out += '-' + p.slice(8, 10);
      phone.value = out;
    });

    // проверка перед отправкой: подсветить первое пустое поле
    f.addEventListener('submit', (e) => {
      const bad = [...f.querySelectorAll('[required]')].find((el) => {
        if (el.type === 'radio') return !f.querySelector(`[name="${el.name}"]:checked`);
        if (el.type === 'checkbox') return !el.checked;
        if (el.name === 'nb_phone') return el.value.replace(/\D/g, '').length < 11;
        return !el.value.trim();
      });
      if (bad) {
        e.preventDefault();
        const box = bad.closest('.nb-field, .nb-consent, .nb-slots') || bad;
        box.classList.add('is-bad');
        box.scrollIntoView({ block: 'center', behavior: 'smooth' });
        (bad.type === 'radio' ? f.querySelector('.nb-slot input:not(:disabled)') : bad)?.focus({ preventScroll: true });
        setTimeout(() => box.classList.remove('is-bad'), 2500);
      }
    });
  });

  // схема зала: какие столы подходят по числу гостей, выбранный стол, фото зоны и вида из окна
  function plan(p) {
    const f = p.closest('form');
    const guests = f && f.querySelector('[name="nb_guests"]');
    const tbls = [...p.querySelectorAll('.nb-tbl')];
    const any = p.querySelector('.nb-plan__any input');
    const info = p.querySelector('.nb-plan__info'), name = p.querySelector('.nb-plan__name'), note = p.querySelector('.nb-plan__note');
    const thumb = p.querySelector('.nb-plan__thumb'), view = p.querySelector('.nb-plan__view');
    const dlg = p.querySelector('.nb-plan__dlg'), img = dlg.querySelector('img'), cap = dlg.querySelector('figcaption');
    const fmt = (s, n) => (s || '').replace('%d', n);
    const open = (src, title) => {
      if (!src) return;
      img.src = src; img.alt = title; cap.textContent = title;
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    };
    const shut = () => { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); };
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('.nb-plan__close')) shut(); });
    p.querySelectorAll('.nb-plan__cam').forEach((b) => b.addEventListener('click', () => open(b.dataset.view, b.dataset.title)));
    let cur = null;
    function say(text, withNote) {
      info.hidden = false; name.textContent = text; note.hidden = !withNote;
    }
    function show() {
      cur = tbls.find((l) => l.querySelector('input').checked) || null;
      tbls.forEach((l) => l.classList.toggle('is-sel', l === cur));
      if (!cur) { info.hidden = true; return; }
      say(cur.dataset.name + ' · ' + fmt(p.dataset.tSeats, cur.dataset.seats), true);
      thumb.hidden = !cur.dataset.photo;
      if (cur.dataset.photo) thumb.querySelector('img').src = cur.dataset.photo;
      view.hidden = !cur.dataset.view;
    }
    thumb.addEventListener('click', () => cur && open(cur.dataset.photo, cur.dataset.name));
    view.addEventListener('click', () => cur && open(cur.dataset.view, cur.dataset.viewTitle));
    function fit() {
      const g = +(guests && guests.value) || 2;
      let reset = null;
      tbls.forEach((l) => {
        const s = +l.dataset.seats, i = l.querySelector('input');
        const off = s < g || s > g + 4;
        i.disabled = off;
        l.classList.toggle('is-off', off);
        l.title = off ? fmt(s < g ? p.dataset.tFew : p.dataset.tBig, s) : l.dataset.name + ' · ' + fmt(p.dataset.tSeats, s);
        if (off && i.checked) { i.checked = false; any.checked = true; reset = i.value; }
      });
      show();
      if (reset) { say(fmt(p.dataset.tReset, reset), false); thumb.hidden = view.hidden = true; }
    }
    // нажали на неподходящий стол (на телефоне подсказки title нет) — объясняем почему
    tbls.forEach((l) => l.addEventListener('click', () => {
      if (!l.classList.contains('is-off')) return;
      say(l.title, false); thumb.hidden = view.hidden = true;
    }));
    p.addEventListener('change', show);
    if (guests) { guests.addEventListener('input', fit); guests.addEventListener('change', fit); }
    fit();
  }
  document.querySelectorAll('[data-plan]').forEach(plan);
})();

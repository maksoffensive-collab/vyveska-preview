/* Небосвод: форма брони. Выходные дни, прошедшее время сегодня, кнопки − / +, маска телефона, подсказка «это банкет». */
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
})();

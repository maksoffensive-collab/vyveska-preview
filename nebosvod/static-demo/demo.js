/* Небосвод, демо-копия: форма брони без отправки, «сегодня» по настоящей дате (а не по дню выгрузки). */
(() => {
  const D = {"hours":["12:00–23:00","12:00–23:00","12:00–23:00","12:00–23:00","12:00–00:00","12:00–00:00","12:00–23:00"],"thanks":{"ru":"/spasibo/","en":"/en/thank-you/"},"base":"/vyveska-preview/nebosvod"};
  const en = (document.documentElement.lang || '').startsWith('en');
  const tz = 'Europe/Moscow';
  const now = new Date();
  const ymd = new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(now);
  const hm = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const day = (s) => new Date(s + 'T12:00:00Z');
  const add = (s, n) => { const d = day(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

  // форма: сегодняшняя дата и время, диапазон дат от сегодня
  document.querySelectorAll('form.nb-book').forEach((f) => {
    const d = f.querySelector('[name="nb_date"]');
    if (d && d.min && d.max) {
      const span = Math.round((day(d.max) - day(d.min)) / 864e5);
      d.min = ymd;
      d.max = add(ymd, span);
    }
    f.dataset.today = ymd;
    f.dataset.now = hm;
  });

  // «сегодня до 23:00» в шапке и на первом экране
  const h = (D.hours[(day(ymd).getUTCDay() + 6) % 7] || '').trim();
  const close = h.split(/\s*[–—-]\s*/)[1] || '';
  const txt = !h || h === '-' ? (en ? 'closed today' : 'сегодня закрыто') : close ? (en ? 'today until ' : 'сегодня до ') + close : h;
  document.querySelectorAll('.nb-top__time, .nb-today').forEach((el) => { el.textContent = txt; });

  // отправка: booking.js уже проверил поля (если что-то пусто — отправку отменил); иначе — «Спасибо» с пометкой «демо»
  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (!f.matches || !f.matches('form.nb-book') || e.defaultPrevented) return;
    e.preventDefault();
    location.href = D.base + D.thanks[en ? 'en' : 'ru'] + '?demo=1';
  });

  // страница «Спасибо» после демо-заявки
  const box = document.querySelector('.nb-thanks');
  if (box && /[?&]demo=1/.test(location.search)) {
    const p = document.createElement('p');
    p.className = 'nb-demo-note';
    p.textContent = en
      ? 'This is a demo copy, so the request went nowhere. On the real site it appears in the admin under “Booking requests”, arrives by email and as a Telegram notice.'
      : 'Это демо-копия, поэтому заявка никуда не ушла. На настоящем сайте она сразу появится в админке в «Заявках на бронь», придёт на почту ресторана и уведомлением в Telegram.';
    box.prepend(p);
  }
})();

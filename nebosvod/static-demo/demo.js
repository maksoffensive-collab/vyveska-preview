/* Небосвод, демо-копия (витрина студии «Вывеска»):
   - форма брони без отправки; «сегодня» по настоящей дате (а не по дню выгрузки);
   - заявка сохраняется в браузере (localStorage «nebo-demo-v1») и видна в демо-админке, «Заявки на бронь»;
   - блюда и акции, добавленные или изменённые в демо-админке, показываются в меню, на главной и в акциях;
   - телефон, почта и соцсети открывают окно «на настоящем сайте здесь…» с кнопкой «Хочу такой сайт». */
(() => {
  const D = {"hours":["12:00–23:00","12:00–23:00","12:00–23:00","12:00–23:00","12:00–00:00","12:00–00:00","12:00–23:00"],"thanks":{"ru":"/spasibo/","en":"/en/thank-you/"},"base":"/vyveska-preview/nebosvod","studio":"/vyveska-preview/vyveska/index.html#tiers"};
  const en = (document.documentElement.lang || '').startsWith('en');
  const tz = 'Europe/Moscow';
  const now = new Date();
  const ymd = new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(now);
  const hm = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const day = (s) => new Date(s + 'T12:00:00Z');
  const add = (s, n) => { const d = day(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const KEY = 'nebo-demo-v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const st = Object.assign({ dishes: [], edits: {}, offers: [], oedits: {}, bookings: [] }, load());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* приватный режим — просто не сохраняем */ } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const price = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';

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

  // отправка: booking.js уже проверил поля (если что-то пусто — отправку отменил); заявку — в демо-админку, затем «Спасибо»
  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (!f.matches || !f.matches('form.nb-book') || e.defaultPrevented) return;
    e.preventDefault();
    const v = (n) => { const x = new FormData(f).get(n); return x == null ? '' : String(x).trim(); };
    const date = v('nb_date'), time = v('nb_time'), g = +v('nb_guests') || 0, ban = v('nb_type') === 'banquet';
    const wd = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][day(date).getUTCDay()];
    const tbl = f.querySelector('.nb-tbl input:checked');
    const tname = tbl ? tbl.closest('.nb-tbl').dataset.name : '';
    const name = v('nb_name') || (en ? 'Guest' : 'Гость');
    st.bookings.unshift({
      title: `${ban ? 'БАНКЕТ: ' : ''}${wd} ${date.slice(8, 10)}.${date.slice(5, 7)} ${time} · ${g} гост.${tbl ? ' · стол ' + tbl.value : ''} — ${name}`,
      table: tname, phone: v('nb_phone'), lang: en ? 'en' : 'ru', at: Date.now(),
    });
    st.bookings = st.bookings.slice(0, 20);
    save();
    location.href = D.base + D.thanks[en ? 'en' : 'ru'] + '?demo=1';
  });

  // страница «Спасибо» после демо-заявки
  const box = document.querySelector('.nb-thanks');
  if (box && /[?&]demo=1/.test(location.search)) {
    const p = document.createElement('p');
    p.className = 'nb-demo-note';
    p.innerHTML = en
      ? `This is a demo copy, so the request went nowhere. On the real site it appears in the admin under “Booking requests”, arrives by email and as a Telegram notice. <a href="${D.base}/admin-demo/zayavki/">See it in the demo admin →</a>`
      : `Это демо-копия, поэтому заявка никуда не ушла. На настоящем сайте она сразу появится в админке в «Заявках на бронь», придёт на почту ресторана и уведомлением в Telegram. <a href="${D.base}/admin-demo/zayavki/">Посмотреть её в демо-админке →</a>`;
    box.prepend(p);
  }

  // блюда из демо-админки: новые — в начало своего раздела, правки — в своих карточках
  const STAR = '<svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0l2.6 7.4L20 10l-7.4 2.6L10 20l-2.6-7.4L0 10l7.4-2.6z" fill="currentColor"/></svg>';
  const CLOCK = '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 9v4l2.5 2M10 2h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const BADGE = { spicy: en ? 'Spicy' : 'Острое', veg: en ? 'Vegetarian' : 'Вегетарианское', new: en ? 'New' : 'Новинка' };
  const meta = (d) => [d.time ? `<span class="nb-card__time">${CLOCK}${esc(d.time)} ${en ? 'min' : 'мин'}</span>` : '', d.weight ? `<span class="nb-card__weight">${esc(d.weight)} ${d.unit === 'ml' ? (en ? 'ml' : 'мл') : (en ? 'g' : 'г')}</span>` : ''].filter(Boolean).join('<span aria-hidden="true"> · </span>');
  const card = (d) => `<article class="nb-card nb-card--demo"><div class="nb-card__media">${d.photo ? `<img class="nb-card__img" src="${esc(d.photo)}" alt="${esc(d.title)}">` : `<div class="nb-card__ph">${STAR}</div>`}<div class="nb-card__badges"><span class="nb-badge nb-badge--demo">${en ? 'Added in the demo' : 'Добавлено в демо'}</span>${(d.badges || []).map((b) => `<span class="nb-badge nb-badge--${esc(b)}">${esc(BADGE[b] || b)}</span>`).join('')}</div></div><div class="nb-card__body"><h3 class="nb-card__title">${esc(d.title)}</h3>${d.desc ? `<p class="nb-card__desc">${esc(d.desc)}</p>` : ''}${d.comp ? `<p class="nb-card__comp">${esc(d.comp)}</p>` : ''}<div class="nb-card__row"><span class="nb-card__meta">${meta(d)}</span>${d.price ? `<span class="nb-card__price">${price(d.price)}</span>` : ''}</div></div></article>`;
  if (!en) {
    const secs = [...document.querySelectorAll('.nb-menu-sec')];
    st.dishes.slice().reverse().forEach((d) => {
      if (d.off) return;
      const sec = secs.find((s) => s.querySelector('h2').textContent.trim() === d.section) || null;
      if (sec) sec.querySelector('.nb-cards').insertAdjacentHTML('afterbegin', card(d));
      else if (secs.length) secs[secs.length - 1].insertAdjacentHTML('afterend', `<section class="nb-menu-sec"><h2 class="nb-menu-sec__title">${esc(d.section || 'Новое')}</h2><div class="nb-cards">${card(d)}</div></section>`);
      if (d.featured) { const home = document.querySelector('.entry-content > .nb-sec .nb-cards'); if (home && !secs.length) home.insertAdjacentHTML('afterbegin', card(d)); }
    });
    Object.entries(st.edits).forEach(([id, d]) => {
      document.querySelectorAll(`.nb-card[data-dish="${id}"]`).forEach((c) => {
        const set = (sel, html) => { const x = c.querySelector(sel); if (x) x.innerHTML = html; };
        set('.nb-card__title', esc(d.title));
        if (c.querySelector('.nb-card__desc')) set('.nb-card__desc', esc(d.desc));
        if (c.querySelector('.nb-card__comp')) set('.nb-card__comp', esc(d.comp));
        set('.nb-card__meta', meta(d));
        if (d.price) set('.nb-card__price', price(d.price));
        if (d.photo && /^data:/.test(d.photo)) { const im = c.querySelector('.nb-card__img'); if (im) { im.src = d.photo; im.removeAttribute('srcset'); } }
        c.classList.toggle('is-off', !!d.off);
        const b = c.querySelector('.nb-card__badges') || c.querySelector('.nb-card__media').appendChild(Object.assign(document.createElement('div'), { className: 'nb-card__badges' }));
        b.insertAdjacentHTML('afterbegin', '<span class="nb-badge nb-badge--demo">Изменено в демо</span>');
      });
    });
    // акции
    const offers = document.querySelector('.nb-offers');
    const ocard = (o) => `<article class="nb-offer nb-offer--demo">${o.photo ? `<div class="nb-offer__media"><img class="nb-offer__img" src="${esc(o.photo)}" alt=""></div>` : ''}<div class="nb-offer__body"><p class="nb-offer__kicker">${STAR.replace('22', '12').replace('22', '12')} Акция · добавлено в демо</p><h3 class="nb-offer__title">${esc(o.title)}</h3>${o.text ? `<p class="nb-offer__text">${esc(o.text).replace(/\n/g, '<br>')}</p>` : ''}<a class="nb-offer__btn" href="${D.base}/bron/">Забронировать стол</a></div></article>`;
    if (offers) st.offers.slice().reverse().forEach((o) => offers.insertAdjacentHTML('afterbegin', ocard(o)));
    Object.entries(st.oedits).forEach(([id, o]) => {
      document.querySelectorAll(`.nb-offer[data-offer="${id}"]`).forEach((c) => {
        const t = c.querySelector('.nb-offer__title'); if (t) t.textContent = o.title;
        const x = c.querySelector('.nb-offer__text'); if (x) x.innerHTML = esc(o.text).replace(/\n/g, '<br>');
      });
    });
  }

  // телефон, почта, соцсети: на витрине — окно «здесь откроется…»
  const T = en
    ? { l: 'demo website', tel: 'Here the guest would call the restaurant', mail: 'Here the guest would write to the restaurant', txt: 'This is a demo website by the “Vyveska” studio. On the real site the button calls or writes straight away.', want: 'I want a site like this', more: 'Keep looking' }
    : { l: 'пример сайта', tel: 'Здесь гость позвонит в ресторан', mail: 'Здесь гость напишет ресторану', txt: 'Это демонстрационный сайт студии «Вывеска»: ресторан вымышленный. На настоящем сайте кнопка сразу звонит или открывает письмо.', want: 'Хочу такой сайт', more: 'Смотреть дальше' };
  let modal = null;
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="tel:"], a[href^="mailto:"]');
    if (!a) return;
    e.preventDefault();
    if (!modal) {
      modal = document.createElement('dialog');
      modal.className = 'nb-demo-dlg';
      modal.innerHTML = `<p class="nb-demo-dlg__l">${T.l}</p><h2></h2><p>${T.txt}</p><p class="nb-demo-dlg__a"><a class="nb-btn" href="${D.studio}">${T.want}</a> <button type="button" class="nb-btn nb-btn--ghost" data-close>${T.more}</button></p>`;
      document.body.append(modal);
      modal.addEventListener('click', (ev) => { if (ev.target === modal || ev.target.closest('[data-close]')) modal.close(); });
    }
    modal.querySelector('h2').textContent = /^tel:/.test(a.getAttribute('href')) ? T.tel : T.mail;
    modal.showModal();
  });
})();

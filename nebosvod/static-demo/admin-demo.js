/* Демо-админка «Небосвода» (витрина студии «Вывеска»): песочница поверх копии экранов простого режима.
   - плашка «Это песочница…» с кнопками «На сайт» и «Сбросить»;
   - ссылки на экраны, которых нет в демо, открывают окно с объяснением;
   - фото выбираются с компьютера или телефона (вместо медиатеки WordPress), сжимаются до 900 px;
   - формы не отправляются. Блюдо и акция сохраняются в браузере (localStorage «nebo-demo-v1»),
     появляются в списках админки и на демо-сайте; заявки с демо-сайта видны в «Заявках на бронь». */
(() => {
  const D = window.NB_DEMO || {};
  const KEY = 'nebo-demo-v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const st = Object.assign({ dishes: [], edits: {}, offers: [], oedits: {}, bookings: [] }, load());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); return true; } catch (e) { return false; } };
  const el = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const price = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  const page = D.page || '';

  /* 1. Плашка песочницы */
  const wrap = document.querySelector('#wpbody-content') || document.body;
  const bar = el(`<div class="nbd-sandbox" role="note"><span class="nbd-sandbox__dot" aria-hidden="true"></span><p><b>Демо-админка «Небосвода».</b> Это песочница: добавьте блюдо или акцию, загляните в заявки и схему зала. Настоящий сайт не изменится — всё сохраняется только в вашем браузере.</p><p class="nbd-sandbox__a"><a class="button" href="${D.base}/" target="_blank" rel="noopener">Открыть сайт ↗</a> <button type="button" class="button-link" data-nbd-reset>Сбросить всё</button></p></div>`);
  wrap.prepend(bar);
  bar.querySelector('[data-nbd-reset]').addEventListener('click', () => {
    if (!confirm('Убрать всё, что вы добавили в демо (блюда, акции, заявки)?')) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* приватный режим */ }
    location.href = D.admin + '/';
  });

  /* 2. Окно с объяснением */
  const dlg = el('<dialog class="nbd-dlg"><p class="nbd-dlg__l">демо-админка</p><h2></h2><p class="nbd-dlg__t"></p><p class="nbd-dlg__a"><button type="button" class="button button-primary" data-nbd-close>Понятно</button></p></dialog>');
  document.body.append(dlg);
  const say = (title, text) => {
    dlg.querySelector('h2').textContent = title; dlg.querySelector('.nbd-dlg__t').textContent = text;
    if (dlg.showModal) dlg.showModal(); else alert(title + '\n\n' + text);
  };
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-nbd-close]')) dlg.close(); });
  const explain = (href) => {
    if (/nb_mode/.test(href)) return ['Режим студии', 'Полное меню WordPress нужно только студии. Владелец работает в простом режиме — его вы сейчас и видите.'];
    if (/logout/.test(href)) return ['Выход', 'В демо выходить не нужно: вы смотрите админку глазами владельца ресторана.'];
    if (/profile\.php/.test(href)) return ['Пароль и профиль', 'Здесь владелец меняет пароль. В демо этот экран не показываем.'];
    if (/post\.php\?post=\d+/.test(href) && page === 'teksty') return ['Тексты страниц', 'Тексты меняются в редакторе WordPress: щёлкнули по абзацу, исправили, сохранили. Он нужен изредка, поэтому в демо его нет.'];
    if (/trash|post_status=trash/.test(href)) return ['Корзина', 'Удалённые блюда и акции 30 дней лежат в корзине — их можно вернуть одной кнопкой.'];
    if (/action=(trash|delete)|nb_off|nb_toggle|nb_samples/.test(href)) return ['Готово — но только в настоящей админке', 'Эта кнопка сразу меняет сайт. В демо она ничего не делает, чтобы витрина оставалась одинаковой для всех.'];
    return ['В демо этого экрана нет', 'Здесь открылся бы ещё один экран админки. В демо показаны главные: меню, акции, заявки, схема зала и адрес с часами.'];
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-demo-na], a[href^="tel:"], a[href^="mailto:"]');
    if (!a) return;
    e.preventDefault(); e.stopPropagation();
    if (a.hasAttribute('data-demo-na')) say(...explain(a.dataset.demoNa));
    else say(/^tel:/.test(a.getAttribute('href')) ? 'Звонок гостю' : 'Письмо гостю', 'В настоящей админке номер и почта нажимаются — и сразу звонок или письмо. В демо гости вымышленные.');
  }, true);

  /* 3. Фото с устройства вместо медиатеки WordPress (тот же интерфейс wp.media, что ждёт admin.js) */
  const pickFile = () => new Promise((res) => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    i.onchange = () => res(i.files[0] || null); i.click();
  });
  const shrink = (file) => new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 900 / im.width), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.8));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
  const media = () => {
    const ev = {}; let sel = null;
    const api = {
      on(n, f) { (ev[n] = ev[n] || []).push(f); return api; },
      open() {
        pickFile().then(async (f) => {
          if (!f) return;
          const url = await shrink(f);
          sel = { id: 'demo-' + Date.now(), url, sizes: { medium: { url }, large: { url }, medium_large: { url } } };
          (ev.select || []).forEach((g) => g());
        });
        return api;
      },
      state() { return { get() { return { first() { return { toJSON() { return sel; } }; } }; } }; },
    };
    return api;
  };
  // свою функцию ставим вместо wp.media, но с теми же свойствами (view, model…): на них опираются другие скрипты WordPress
  const setMedia = () => {
    window.wp = window.wp || {};
    const orig = window.wp.media;
    if (orig && orig.__nbd) return;
    const shim = function (o) { return media(o); };
    if (orig) Object.keys(orig).forEach((k) => { shim[k] = orig[k]; });
    shim.__nbd = true;
    window.wp.media = shim;
  };
  setMedia();
  window.addEventListener('load', () => { if (window.wp.media && !window.wp.media.__nbd) setMedia(); }); // media-views.js мог поставить свою медиатеку позже

  /* 4. Сообщение после «сохранения» */
  const notice = (html) => {
    const n = el(`<div class="notice notice-success nbd-notice"><p>${html}</p></div>`);
    const w = document.querySelector('#wpbody-content .wrap') || wrap;
    const h1 = w.querySelector('h1, .wp-heading-inline');
    (h1 && h1.parentNode === w ? h1 : w.firstElementChild).insertAdjacentElement('afterend', n);
  };
  const qs = new URLSearchParams(location.search);
  const site = (p) => `<a href="${D.base}${p}" target="_blank" rel="noopener">${p === '/menyu/' ? 'меню на сайте' : 'на сайте'} ↗</a>`;
  if (qs.get('nbd') === 'dish') notice(`<b>Блюдо сохранено.</b> Оно уже в этом списке и в ${site('/menyu/')} — в демо только у вас в браузере.`);
  if (qs.get('nbd') === 'offer') notice(`<b>Акция сохранена.</b> Она в списке и ${site('/akcii/')} — в демо только у вас в браузере.`);
  if (qs.get('nbd') === 'saved') notice('<b>Сохранено.</b> На настоящем сайте изменения видны сразу. В демо они не сохраняются, чтобы витрина была одинаковой для всех.');

  /* 5. Формы: проверка admin.js уже прошла (иначе он отменил отправку) — сохраняем в браузере */
  const fd = (f, n) => { const v = new FormData(f).get(n); return v == null ? '' : String(v).trim(); };
  const pickedPhoto = () => { const im = document.querySelector('.nb-photo__box img'); return im ? im.src : ''; };
  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (!f.matches || !f.matches('form[data-demo-form]') || e.defaultPrevented) return;
    e.preventDefault();
    const isDish = /^bludo/.test(page), isOffer = /^akciya/.test(page);
    if (f.id === 'post' && isDish) {
      const sec = f.querySelector('input[name="nb_section"]:checked');
      const secName = sec && sec.value === 'new' ? fd(f, 'nb_section_new') : (sec ? sec.closest('label').textContent.trim() : '');
      const d = {
        title: fd(f, 'post_title'), section: secName, price: fd(f, '_nb_price'), weight: fd(f, '_nb_weight'), unit: fd(f, '_nb_unit'),
        time: fd(f, '_nb_time'), desc: fd(f, '_nb_desc_ru'), comp: fd(f, '_nb_comp_ru'), photo: pickedPhoto(),
        badges: new FormData(f).getAll('_nb_badges[]'), featured: !!fd(f, '_nb_featured'), off: !!fd(f, '_nb_off'),
      };
      const m = page.match(/^bludo-(\d+)$/);
      if (m) st.edits[m[1]] = d; else st.dishes.unshift(Object.assign({ id: 'd' + Date.now() }, d));
      if (!save()) { say('Не хватило места', 'Браузер не дал сохранить: фото слишком большое или включён приватный режим.'); return; }
      location.href = D.admin + '/menyu/?nbd=dish';
      return;
    }
    if (f.id === 'post' && isOffer) {
      const o = { title: fd(f, 'post_title'), text: fd(f, '_nb_text_ru'), start: fd(f, '_nb_start'), end: fd(f, '_nb_end'), discount: fd(f, '_nb_discount'), photo: pickedPhoto() };
      const m = page.match(/^akciya-(\d+)$/);
      if (m) st.oedits[m[1]] = o; else st.offers.unshift(Object.assign({ id: 'o' + Date.now() }, o));
      save();
      location.href = D.admin + '/akcii/?nbd=offer';
      return;
    }
    if (/posts-filter|search/i.test(f.id || '') || f.querySelector('input[name="s"]')) {
      say('Поиск', 'В настоящей админке здесь ищется блюдо или заявка по названию или имени гостя. В демо поиск не работает.');
      return;
    }
    location.href = location.pathname + '?nbd=saved' + location.hash;
  });

  /* 6. Списки: добавленное в демо — сверху, правки — в своих строках */
  const list = document.querySelector('#the-list');
  const firstRow = list && list.querySelector('tr');
  const tag = '<span class="nbd-tag">добавлено в демо</span>';
  const cell = (tr, col) => tr.querySelector('.column-' + col);
  // у копии строки убираем скрытые данные исходной (для «Свойств») и кнопку раскрытия на телефоне
  const clean = (tr) => { tr.querySelectorAll('.hidden, .toggle-row, .row-actions, .post-state').forEach((x) => x.remove()); return tr; };
  if (list && firstRow && page === 'menyu') {
    st.dishes.slice().reverse().forEach((d) => {
      const tr = clean(firstRow.cloneNode(true)); tr.id = ''; tr.classList.add('nbd-row');
      const a = tr.querySelector('.column-title a.row-title') || tr.querySelector('.column-title a');
      if (a) { a.textContent = d.title; a.setAttribute('href', '#'); a.setAttribute('data-demo-na', 'demo-dish'); }
      tr.querySelectorAll('.row-actions').forEach((x) => x.remove());
      const ph = cell(tr, 'nb_photo'); if (ph) ph.innerHTML = d.photo ? `<img src="${esc(d.photo)}" alt="" class="nbd-thumb">` : '<span class="nbd-nophoto">нет фото</span>';
      const sc = cell(tr, 'taxonomy-nebo_section'); if (sc) sc.textContent = d.section;
      const pr = cell(tr, 'nb_price'); if (pr) pr.textContent = d.price ? price(d.price) : '';
      const tm = cell(tr, 'nb_time'); if (tm) tm.textContent = d.time ? d.time + ' мин' : '—';
      const fl = cell(tr, 'nb_flags'); if (fl) fl.innerHTML = '<span class="nbd-on">● В меню</span> ' + tag;
      list.prepend(tr);
    });
    Object.entries(st.edits).forEach(([id, d]) => {
      const tr = document.getElementById('post-' + id); if (!tr) return;
      const a = tr.querySelector('.column-title a.row-title'); if (a) a.textContent = d.title;
      const pr = cell(tr, 'nb_price'); if (pr) pr.textContent = d.price ? price(d.price) : '';
      const tm = cell(tr, 'nb_time'); if (tm) tm.textContent = d.time ? d.time + ' мин' : '—';
      if (d.photo && /^data:/.test(d.photo)) { const ph = cell(tr, 'nb_photo'); if (ph) ph.innerHTML = `<img src="${esc(d.photo)}" alt="" class="nbd-thumb">`; }
      const fl = cell(tr, 'nb_flags'); if (fl) fl.insertAdjacentHTML('beforeend', ' <span class="nbd-tag">изменено в демо</span>');
    });
  }
  if (list && firstRow && page === 'akcii') {
    st.offers.slice().reverse().forEach((o) => {
      const tr = clean(firstRow.cloneNode(true)); tr.id = ''; tr.classList.add('nbd-row');
      const a = tr.querySelector('.column-title a.row-title') || tr.querySelector('.column-title a');
      if (a) { a.textContent = o.title; a.setAttribute('href', '#'); a.setAttribute('data-demo-na', 'demo-offer'); }
      tr.querySelectorAll('.row-actions').forEach((x) => x.remove());
      const ph = cell(tr, 'nb_photo'); if (ph) ph.innerHTML = o.photo ? `<img src="${esc(o.photo)}" alt="" class="nbd-thumb">` : '<span class="nbd-nophoto">нет фото</span>';
      const s = cell(tr, 'nb_state'); if (s) s.innerHTML = tag;
      const dc = cell(tr, 'nb_disc'); if (dc) dc.textContent = o.discount ? '−' + o.discount + ' %' : '—';
      list.prepend(tr);
    });
  }
  if (list && firstRow && page === 'zayavki' && st.bookings.length) {
    st.bookings.slice().reverse().forEach((b) => {
      const tr = clean(firstRow.cloneNode(true)); tr.id = ''; tr.classList.add('nbd-row');
      const a = tr.querySelector('.column-title a.row-title') || tr.querySelector('.column-title a');
      if (a) { a.textContent = b.title; a.setAttribute('href', '#'); a.setAttribute('data-demo-na', 'demo-booking'); }
      tr.querySelectorAll('.row-actions').forEach((x) => x.remove());
      const t = cell(tr, 'nb_table'); if (t) t.innerHTML = b.table ? esc(b.table) : '<span style="color:#787c82">любой</span>';
      const p = cell(tr, 'nb_phone'); if (p) p.innerHTML = `<a href="tel:+7">${esc(b.phone)}</a>`;
      const l = cell(tr, 'nb_lang'); if (l) l.textContent = (b.lang || 'ru').toUpperCase();
      const m = cell(tr, 'nb_mail'); if (m) m.innerHTML = '<span class="nbd-tag">с демо-сайта</span>';
      const dt = cell(tr, 'date'); if (dt) dt.textContent = 'Только что';
      list.prepend(tr);
    });
    notice(`<b>Ваши заявки с демо-сайта — сверху.</b> На настоящем сайте заявка ещё приходит на почту ресторана и уведомлением в Telegram.`);
  }
  // главная: счётчик заявок в плитке
  if (page === '' && st.bookings.length) {
    const t = [...document.querySelectorAll('.nb-tile')].find((x) => /Заявки на бронь/.test(x.textContent));
    const d = t && t.querySelector('.nb-tile__d');
    if (d) d.innerHTML = `<b>Новых из демо: ${st.bookings.length}.</b> Ещё они приходят письмом.`;
  }
})();

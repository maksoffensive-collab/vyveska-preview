/* Формы «Блюдо» и «Акция» в админке «Небосвода»: живой предпросмотр «Так увидят гости», фото прямо в форме,
   быстрый выбор срока акции, проверка перед сохранением. Сохраняет стандартная кнопка WordPress «Опубликовать»
   (она спрятана) — так работают все обычные проверки и автосохранение WordPress. */
(function () {
  'use strict';
  var D = window.nbAdmin || {};
  var form = document.getElementById('post');
  var box = document.querySelector('.nb-form');
  if (!form || !box) return;

  var kind = D.kind;
  var title = document.getElementById('title');
  var stage = box.querySelector('.nb-pv__stage');
  var el = function (n) { return form.elements[n]; };
  var val = function (n) { var e = el(n); return e && e.value != null ? String(e.value).trim() : ''; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var nl2br = function (s) { return esc(s).replace(/\n/g, '<br>'); };
  var money = function (n) { return Math.round(+n || 0).toLocaleString('ru-RU').replace(/\s/g, ' ') + ' ₽'; };
  var STAR = '<svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0l2.6 7.4L20 10l-7.4 2.6L10 20l-2.6-7.4L0 10l7.4-2.6z" fill="currentColor"/></svg>';
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  form.noValidate = true; // проверяем сами и пишем по-русски, что исправить

  /* ---------- Даты ---------- */
  function parse(ymd) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function human(s, withYear) {
    var d = parse(s); if (!d) return s;
    var y = d.getFullYear();
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + (withYear || String(y) !== D.today.slice(0, 4) ? ' ' + y : '');
  }
  function days(a, b) { return Math.round((parse(b) - parse(a)) / 864e5) + 1; }
  function plural(n, one, few, many) { var a = n % 10, b = n % 100; return n + ' ' + (a === 1 && b !== 11 ? one : (a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many)); }

  /* ---------- Фото ---------- */
  var photoUrl = '';
  var ph = box.querySelector('.nb-photo');
  if (ph) {
    var input = ph.querySelector('input[name="nb_photo"]');
    var pbox = ph.querySelector('.nb-photo__box');
    var pick = ph.querySelector('.nb-photo__pick');
    var del = ph.querySelector('.nb-photo__del');
    var img0 = pbox.querySelector('img');
    photoUrl = img0 ? img0.src : '';
    var frame = null;
    var open = function () {
      if (!window.wp || !wp.media) { alert('Не загрузилась библиотека фото. Обновите страницу.'); return; }
      if (!frame) {
        frame = wp.media({ title: kind === 'dish' ? 'Фото блюда' : 'Фото акции', button: { text: 'Выбрать это фото' }, library: { type: 'image' }, multiple: false });
        frame.on('select', function () {
          var a = frame.state().get('selection').first().toJSON();
          var s = a.sizes || {};
          photoUrl = (s.medium_large || s.large || s.medium || a).url;
          input.value = a.id;
          pbox.innerHTML = '<img src="' + esc(photoUrl) + '" alt="">';
          pick.textContent = 'Заменить фото'; del.hidden = false;
          render();
        });
      }
      frame.open();
    };
    pbox.addEventListener('click', open);
    pick.addEventListener('click', open);
    del.addEventListener('click', function () {
      input.value = ''; photoUrl = '';
      pbox.innerHTML = '<span>Нажмите, чтобы загрузить фото</span>';
      pick.textContent = 'Загрузить фото'; del.hidden = true;
      render();
    });
  }

  /* ---------- Предпросмотр ---------- */
  function dishCard() {
    var name = title.value.trim();
    var desc = val('_nb_desc_ru'), comp = val('_nb_comp_ru'), price = val('_nb_price'), w = val('_nb_weight'), t = val('_nb_time');
    var unit = val('_nb_unit') === 'ml' ? 'мл' : 'г';
    var off = el('_nb_off') && el('_nb_off').checked;
    var badges = [].slice.call(form.querySelectorAll('input[name="_nb_badges[]"]:checked')).map(function (i) { return '<span class="pv-badge">' + esc(i.dataset.label) + '</span>'; }).join('');
    var meta = [];
    if (t) meta.push('⏱ ' + esc(t) + ' мин');
    if (w) meta.push(esc(w) + ' ' + unit);
    var h = '<article class="pv-card' + (off ? ' is-off' : '') + '"><div class="pv-card__media">';
    h += photoUrl ? '<img src="' + esc(photoUrl) + '" alt="">' : '<div class="pv-ph">' + STAR + '</div>';
    h += (badges ? '<div class="pv-badges">' + badges + '</div>' : '') + (off ? '<span class="pv-off">Сегодня нет</span>' : '') + '</div>';
    h += '<div class="pv-body"><h3 class="pv-title' + (name ? '' : ' is-empty') + '">' + (name ? esc(name) : 'Название блюда') + '</h3>';
    if (desc) h += '<p class="pv-desc">' + esc(desc) + '</p>';
    if (comp) h += '<p class="pv-comp">' + esc(comp) + '</p>';
    h += '<div class="pv-row"><span>' + meta.join(' · ') + '</span><span class="pv-price' + (price ? '' : ' is-empty') + '">' + (price ? money(price) : 'цена') + '</span></div></div></article>';
    var sec = form.querySelector('input[name="nb_section"]:checked');
    var sname = sec ? (sec.value === 'new' ? val('nb_section_new') : sec.parentNode.textContent.trim()) : '';
    h += '<p class="pv-note">' + (sname ? 'В меню, раздел «' + esc(sname) + '»' : 'Раздел меню ещё не выбран') + (el('_nb_featured') && el('_nb_featured').checked ? ' · и на главной' : '') + '.</p>';
    return h;
  }

  function offerState() {
    var s = val('_nb_start'), e = val('_nb_end'), st = el('_nb_start'), en = el('_nb_end');
    if ((s && !parse(s)) || (e && !parse(e)) || (s && (s < D.min || s > D.max)) || (e && (e < D.min || e > D.max))) {
      var bad = (s && (s < D.min || s > D.max)) ? s : e;
      return { cls: 'is-err', text: 'Проверьте год в дате' + (bad ? ' (' + bad.split('-').reverse().join('.') + ')' : '') + ': можно выбрать не дальше чем через 2 года.', err: true };
    }
    if (s && e && e < s) return { cls: 'is-err', text: 'Последний день раньше первого — поменяйте даты.', err: true };
    if (s && s > D.today) return { cls: 'is-soon', text: 'Появится на сайте ' + human(s) + ' сама' + (e ? ' и будет до ' + human(e) + ' включительно (' + plural(days(s, e), 'день', 'дня', 'дней') + ')' : ', без срока') + '.' };
    if (e && e < D.today) return { cls: '', text: 'Последний день уже прошёл (' + human(e) + ') — на сайте акцию видно не будет.', warn: true };
    var now = D.published ? 'Сейчас на сайте' : 'Будет на сайте сразу после сохранения';
    return { cls: 'is-on', text: now + (e ? ', до ' + human(e) + ' включительно (ещё ' + plural(days(D.today, e), 'день', 'дня', 'дней') + ')' : ', без срока — уберёте сами') + '.' };
  }

  function offerCard() {
    var name = title.value.trim(), text = val('_nb_text_ru'), s = val('_nb_start'), e = val('_nb_end');
    var dates = ((s ? 'с ' + human(s, true) + ' ' : '') + (e ? 'до ' + human(e, true) : '')).trim();
    var h = '<article class="pv-offer">' + (photoUrl ? '<div class="pv-offer__media"><img src="' + esc(photoUrl) + '" alt=""></div>' : '');
    h += '<div class="pv-body"><p class="pv-kicker">★ Акция</p><h3 class="pv-title' + (name ? '' : ' is-empty') + '">' + (name ? esc(name) : 'Название акции') + '</h3>';
    h += text ? '<p class="pv-desc">' + nl2br(text) + '</p>' : '<p class="pv-desc is-empty">Что получает гость</p>';
    if (dates) h += '<p class="pv-dates">' + esc(dates) + '</p>';
    h += '<span class="pv-btn">' + esc(D.book || 'Забронировать стол') + '</span></div></article>';
    h += '<p class="pv-note">Видно на главной и на странице «Акции».</p>';
    return h;
  }

  var statusBox = box.querySelector('.nb-status');
  var dsum = box.querySelector('.nb-dsum');
  function render() {
    if (kind === 'dish') {
      stage.innerHTML = dishCard();
    } else {
      stage.innerHTML = offerCard();
      var st = offerState();
      statusBox.innerHTML = '<span class="nb-dot ' + st.cls + '"></span>' + esc(st.text);
      if (dsum) { dsum.textContent = st.text; dsum.classList.toggle('is-err', !!st.err); }
      discount();
    }
  }

  /* ---------- Акция: быстрый срок и скидка ---------- */
  box.querySelectorAll('[data-end]').forEach(function (b) {
    b.addEventListener('click', function () {
      var s = parse(val('_nb_start')) || parse(D.today), k = b.dataset.end, e = el('_nb_end');
      if (!val('_nb_start')) el('_nb_start').value = ymd(s);
      if (k === 'none') { e.value = ''; }
      else if (k === 'eom') { e.value = ymd(new Date(s.getFullYear(), s.getMonth() + 1, 0, 12)); }
      else { var d = new Date(s); d.setDate(d.getDate() + (+k) - 1); e.value = ymd(d); }
      render();
    });
  });
  function discount() {
    var d = Math.min(90, Math.max(0, parseInt(val('_nb_discount'), 10) || 0));
    form.querySelectorAll('.nb-dp').forEach(function (sp) {
      var p = +sp.dataset.price, on = sp.parentNode.querySelector('input').checked;
      sp.innerHTML = d && on ? '<s>' + money(p) + '</s> <b>' + money(Math.max(0, Math.round(p * (100 - d) / 100 / 10) * 10)) + '</b>' : money(p);
    });
  }

  /* ---------- Раздел меню: «+ Новый раздел» ---------- */
  var newsec = box.querySelector('.nb-newsec');
  function secToggle() {
    var c = form.querySelector('input[name="nb_section"]:checked');
    if (newsec) { newsec.hidden = !(c && c.value === 'new'); if (!newsec.hidden) newsec.querySelector('input').focus(); }
  }

  /* ---------- Проверка и сохранение ---------- */
  function clearErr() {
    box.querySelectorAll('.nb-f.has-err').forEach(function (f) { f.classList.remove('has-err'); var m = f.querySelector('.nb-errmsg'); if (m) m.remove(); });
    title.classList.remove('nb-err-input');
    var te = document.querySelector('.nb-title-err'); if (te) te.remove();
  }
  function fieldErr(key, msg) {
    var f = box.querySelector('.nb-f[data-f="' + key + '"]');
    if (!f) return null;
    var d = f.closest('details'); if (d) d.open = true;
    f.classList.add('has-err');
    if (!msg) return f; // текст ошибки уже виден рядом (например, под датами)
    var p = document.createElement('p'); p.className = 'nb-errmsg'; p.textContent = msg;
    f.querySelector('.nb-f__label').insertAdjacentElement('afterend', p);
    return f;
  }
  function validate() {
    clearErr();
    var first = null, add = function (n) { if (n && !first) first = n; };
    if (!title.value.trim()) {
      title.classList.add('nb-err-input');
      var p = document.createElement('p'); p.className = 'nb-title-err'; p.textContent = kind === 'dish' ? 'Напишите название блюда.' : 'Напишите название акции.';
      title.insertAdjacentElement('afterend', p);
      add(title);
    }
    if (kind === 'dish') {
      var c = form.querySelector('input[name="nb_section"]:checked');
      if (!c) add(fieldErr('section', 'Выберите раздел меню.'));
      else if (c.value === 'new' && !val('nb_section_new')) add(fieldErr('section', 'Напишите название нового раздела.'));
      if (!(parseInt(val('_nb_price'), 10) > 0)) add(fieldErr('price', 'Укажите цену.'));
    } else {
      var st = offerState();
      if (st.err) add(fieldErr('dates', ''));
      if ((parseInt(val('_nb_discount'), 10) || 0) > 0 && !form.querySelector('input[name="_nb_dishes[]"]:checked')) add(fieldErr('discount', 'Указана скидка, но не отмечены блюда. Отметьте блюда или сотрите скидку.'));
    }
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var inp = first.matches && first.matches('input,textarea') ? first : first.querySelector('input:not([type=hidden]),textarea');
      if (inp) setTimeout(function () { inp.focus({ preventScroll: true }); }, 300);
      return false;
    }
    return true;
  }
  document.querySelectorAll('.nb-save').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!validate()) return;
      if (kind === 'offer' && offerState().warn && !confirm('Последний день акции уже прошёл — на сайте её видно не будет. Всё равно сохранить?')) return;
      var pub = document.getElementById('publish');
      if (!pub) { alert('Не нашлась кнопка сохранения WordPress. Обновите страницу.'); return; }
      document.querySelectorAll('.nb-save').forEach(function (x) { x.disabled = true; x.textContent = 'Сохраняем…'; });
      pub.click();
    });
  });
  // Enter в поле не отправляет форму (иначе WordPress сохранил бы черновик, а не на сайт)
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.matches('input:not([type=submit]):not([type=button])')) e.preventDefault();
  });
  box.querySelectorAll('.nb-del').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (!confirm('Удалить ' + a.dataset.what + '? Её можно будет вернуть из «Удалённых» в течение 30 дней.'.replace('Её', a.dataset.what === 'блюдо' ? 'Его' : 'Её'))) e.preventDefault();
    });
  });

  form.addEventListener('input', render);
  form.addEventListener('change', function (e) { if (e.target.name === 'nb_section') secToggle(); render(); });
  title.addEventListener('input', function () { if (title.value.trim()) { title.classList.remove('nb-err-input'); var te = document.querySelector('.nb-title-err'); if (te) te.remove(); } });
  secToggle();
  render();
  if (!title.value) title.focus();
})();

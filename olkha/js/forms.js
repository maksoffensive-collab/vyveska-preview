/* Ольха — заявки: маска телефона, проверка полей, отправка в api/zayavka.php.
   В демо-режиме (<body data-demo>) заявка никуда не уходит: показываем, как она выглядела бы у администратора.
   Общие функции доступны как window.Olkha — их использует и бронь (booking.js). */
(() => {
  'use strict';

  const demo = document.body.hasAttribute('data-demo');
  // адрес приёма заявок, телефон и ссылку на студию задаёт WordPress в <body>; у статического сайта — свои
  const api = document.body.dataset.api || 'api/zayavka.php';
  const phone = document.body.dataset.phone || '+7 (495) 000-00-00';
  const studio = document.body.dataset.studio || '../vyveska/index.html#tiers';
  const opened = Date.now();
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

  /* +7 (916) 123-45-67 */
  const formatPhone = (value) => {
    let d = value.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (!d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);
    const p = d.slice(1);
    let out = '+7';
    if (p.length) out += ` (${p.slice(0, 3)}`;
    if (p.length >= 3) out += ')';
    if (p.length > 3) out += ` ${p.slice(3, 6)}`;
    if (p.length > 6) out += `-${p.slice(6, 8)}`;
    if (p.length > 8) out += `-${p.slice(8, 10)}`;
    return out;
  };
  const phoneOk = (v) => v.replace(/\D/g, '').length === 11;
  const bindPhone = (input) => {
    input.addEventListener('focus', () => { if (!input.value) input.value = '+7 ('; });
    input.addEventListener('blur', () => { if (input.value.replace(/\D/g, '').length <= 1) input.value = ''; });
    input.addEventListener('input', () => { input.value = formatPhone(input.value); });
  };

  const humanDate = (iso) => {
    const d = new Date(`${iso}T12:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return `${DAYS[d.getDay()][0].toUpperCase()}${DAYS[d.getDay()][1]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };
  const stamp = () => {
    const n = new Date();
    return `${n.getDate()} ${MONTHS[n.getMonth()]}, ${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  };

  /* текст, который придёт администратору (тот же собирает api/zayavka.php) */
  const message = (type, f, number) => {
    const L = [];
    if (type === 'bron') {
      L.push(`🔥 Бронь — «Ольха» · №${number}`);
      L.push(`${humanDate(f.date)} · ${f.time} · ${f.guests} ${plural(f.guests, 'гость', 'гостя', 'гостей')}`);
      L.push(f.table ? `${f.hall} · ${f.table}` : `${f.hall} · стол на выбор администратора`);
      if (f.set) L.push('Сет шефа «Вечер у огня»');
    } else if (type === 'banquet') {
      L.push(`🎉 Банкет — «Ольха» · №${number}`);
      L.push(`${humanDate(f.date)} · ${f.guests} ${plural(f.guests, 'гость', 'гостя', 'гостей')}`);
      L.push(`${f.occasion} · бюджет ${f.budget}`);
    } else if (type === 'event') {
      L.push(`🕯 Запись на событие · №${number}`);
      L.push(`${f.event} · ${f.guests} чел.`);
    } else if (type === 'certificate') {
      L.push(`🎁 Сертификат · №${number}`);
      L.push(f.nominal);
    }
    L.push(`${f.name} · ${f.phone}`);
    if (f.occasionBron) L.push(`Повод: ${f.occasionBron}`);
    if (f.comment) L.push(`Пожелания: ${f.comment}`);
    L.push(`С сайта · ${stamp()}`);
    return L.join('\n');
  };
  function plural(n, one, few, many) {
    n = Math.abs(Number(n)) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return many;
    if (n1 > 1 && n1 < 5) return few;
    if (n1 === 1) return one;
    return many;
  }

  const tgPreview = (text) => {
    const wrap = document.createElement('div');
    wrap.className = 'tg';
    const from = document.createElement('span');
    from.className = 'tg__from';
    from.textContent = 'Бот «Ольха · заявки»';
    const body = document.createElement('span');
    body.textContent = text;
    const time = document.createElement('span');
    time.className = 'tg__time';
    const n = new Date();
    time.textContent = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
    wrap.append(from, body, time);
    return wrap;
  };

  /* отправка: в демо — только номер; на сайте клиента — api/zayavka.php */
  const send = async (type, fields, extra = {}) => {
    const number = String(Math.floor(1000 + Math.random() * 9000));
    if (demo) {
      await new Promise((r) => setTimeout(r, 600));
      return { ok: true, number, text: message(type, fields, number) };
    }
    const res = await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, fields, elapsed: Date.now() - opened, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok, number: data.number || number, text: message(type, fields, data.number || number), error: data.error };
  };

  /* экран «готово»: в демо показываем превью сообщения администратору */
  const showDone = (box, title, lead, text) => {
    box.innerHTML = '';
    const label = document.createElement('p');
    label.className = 'label';
    label.textContent = 'заявка принята';
    const h = document.createElement('h3');
    h.className = 'h3';
    h.innerHTML = title;
    const p = document.createElement('p');
    p.className = 'text';
    p.textContent = lead;
    box.append(label, h, p);
    if (demo) {
      const note = document.createElement('p');
      note.className = 'muted';
      note.textContent = 'Так заявка выглядит у администратора в Telegram (и дублируется на почту):';
      box.append(note, tgPreview(text));
      const a = document.createElement('a');
      a.className = 'btn btn--fire';
      a.href = studio;
      a.textContent = 'Хочу такой сайт';
      box.append(a);
    }
    box.hidden = false;
  };

  /* проверка: обязательные поля, телефон, согласие */
  const validate = (form) => {
    let first = null;
    form.querySelectorAll('[required]').forEach((el) => {
      const field = el.closest('.field');
      let bad = el.type === 'checkbox' ? !el.checked : !el.value.trim();
      if (!bad && el.hasAttribute('data-phone')) bad = !phoneOk(el.value);
      if (!bad && el.type === 'number') bad = Number(el.value) < Number(el.min || 0) || Number(el.value) > Number(el.max || 1e9);
      if (field) field.classList.toggle('is-error', bad);
      if (bad && !first) first = el;
    });
    return first;
  };

  window.Olkha = { formatPhone, bindPhone, phoneOk, humanDate, send, showDone, validate, plural, demo, phone };

  /* ---------- формы на странице событий и банкетов ---------- */
  document.querySelectorAll('[data-phone]').forEach(bindPhone);
  document.querySelectorAll('[data-min-today]').forEach((el) => {
    const d = new Date();
    el.min = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const TEXTS = {
    event: ['Вы записаны <em>до встречи</em>', 'Администратор перезвонит в течение часа и подтвердит запись.'],
    banquet: ['Спасибо, <em>получили</em>', 'Менеджер банкетов свяжется с вами сегодня или завтра утром.'],
    certificate: ['Сертификат <em>ждёт вас</em>', 'Перезвоним, чтобы договориться, когда забрать или куда привезти.'],
  };
  document.querySelectorAll('form[data-form]').forEach((form) => {
    const type = form.dataset.form;
    if (!TEXTS[type]) return;
    const status = form.querySelector('.form__status');
    const done = form.parentElement.querySelector('[data-done]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bad = validate(form);
      if (bad) { status.textContent = 'Проверьте поля, отмеченные красным.'; status.classList.add('is-error'); bad.focus(); return; }
      if (form.company && form.company.value) return;   // бот заполнил скрытое поле
      status.classList.remove('is-error');
      status.textContent = 'Отправляем…';
      const fields = Object.fromEntries(new FormData(form));
      delete fields.company;
      delete fields.consent;
      try {
        const r = await send(type, fields, { consent: true, hp: '' });
        if (!r.ok) throw new Error(r.error || 'send');
        form.hidden = true;
        showDone(done, TEXTS[type][0], TEXTS[type][1], r.text);
        done.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        status.classList.add('is-error');
        status.textContent = `Не получилось отправить. Позвоните нам: ${phone}.`;
      }
    });
  });

  /* «Записаться» у события выбирает его в форме */
  const eventSelect = document.querySelector('[data-event-select]');
  document.querySelectorAll('[data-event]').forEach((btn) => {
    btn.addEventListener('click', () => { if (eventSelect) eventSelect.value = btn.dataset.event; });
  });
})();

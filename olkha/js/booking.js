/* Ольха — бронь в три шага: когда (дата, время, гости) → где (зал и стол на схеме) → кто (контакты).
   Это заявка, а не учёт столов: выбранный стол — пожелание гостя, администратор подтверждает его звонком.
   Недоступно только то, что следует из правил: прошедшее время, стол меньше компании, терраса не в сезон. */
(() => {
  'use strict';

  const root = document.querySelector('[data-booking]');
  if (!root || !window.Olkha) return;
  const O = window.Olkha;
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];

  // на WordPress картинки лежат в папке темы: <body data-assets="…/assets/">; на статическом сайте — рядом
  const A = (path) => (document.body.dataset.assets || '') + path;

  const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const times = (sel, def) => { const v = root.querySelector(sel)?.dataset.times; return v ? v.split(',').map((t) => t.trim()).filter(Boolean) : def; };
  const LUNCH = times('[data-slots-lunch]', ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30']);
  const DINNER = times('[data-slots-dinner]', ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30']);
  const DAYS_AHEAD = 60;

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const lastDay = new Date(today); lastDay.setDate(lastDay.getDate() + DAYS_AHEAD);

  /* ---------- залы: столы в процентах от схемы (10 : 7) ---------- */
  const HALLS = {
    pech: {
      name: 'Зал у печи', photo: A('img/hall-pech-720.webp'),
      svg: `<g fill="none" stroke="currentColor" stroke-width="2"><path d="M10 10H990V690H800M700 690H10V10"/><path d="M860 250h100v350h-100z"/></g>
        <path class="plan__fire" d="M420 10V64Q500 122 580 64V10" stroke-width="2"/>
        <path d="M10 90V190M10 290V390M10 490V590" stroke="rgba(242,203,142,.6)" stroke-width="7"/>
        <text x="500" y="145" text-anchor="middle">печь</text>
        <text transform="translate(910 425) rotate(-90)" text-anchor="middle">бар</text>
        <text x="750" y="676" text-anchor="middle">вход</text>`,
      tables: [
        { id: 1, seats: 2, shape: 'sq', x: 4.2, y: 12, w: 7, h: 10, where: 'у панорамного окна', view: A('img/cover-720.webp') },
        { id: 2, seats: 2, shape: 'sq', x: 4.2, y: 41, w: 7, h: 10, where: 'у панорамного окна', view: A('img/cover-720.webp') },
        { id: 3, seats: 2, shape: 'sq', x: 4.2, y: 70, w: 7, h: 10, where: 'у панорамного окна', view: A('img/cover-720.webp') },
        { id: 4, seats: 4, shape: 'round', x: 24, y: 33, w: 10, h: 14.3, where: 'в центре зала', view: A('img/hall-pech-720.webp') },
        { id: 5, seats: 4, shape: 'round', x: 44, y: 33, w: 10, h: 14.3, where: 'в центре, напротив печи', view: A('img/oven-600.webp') },
        { id: 6, seats: 4, shape: 'round', x: 64, y: 33, w: 10, h: 14.3, where: 'в центре зала', view: A('img/hall-pech-720.webp') },
        { id: 7, seats: 4, shape: 'round', x: 24, y: 64, w: 10, h: 14.3, where: 'в тихой части зала', view: A('img/interior-lamps-720.webp') },
        { id: 8, seats: 4, shape: 'round', x: 44, y: 64, w: 10, h: 14.3, where: 'в тихой части зала', view: A('img/interior-beams-720.webp') },
        { id: 9, seats: 6, shape: 'long', x: 21, y: 5, w: 15, h: 11, where: 'у печи', view: A('img/oven-600.webp') },
        { id: 10, seats: 6, shape: 'long', x: 64, y: 5, w: 15, h: 11, where: 'у печи', view: A('img/grill-600.webp') },
      ],
    },
    kamin: {
      name: 'Камин', photo: A('img/hall-kamin-720.webp'), minGuests: 6,
      svg: `<g fill="none" stroke="currentColor" stroke-width="2"><path d="M10 10H990V690H180M90 690H10V10"/></g>
        <path class="plan__fire" d="M410 10h180v70H410z" stroke-width="2"/>
        <path d="M990 200V320M990 400V520" stroke="rgba(242,203,142,.6)" stroke-width="7"/>
        <text x="500" y="112" text-anchor="middle">камин</text>
        <text x="135" y="676" text-anchor="middle">вход</text>`,
      tables: [{ id: 'К', label: 'стол', seats: 12, shape: 'long', x: 20, y: 42, w: 60, h: 16, where: 'длинный стол у камина, весь зал ваш', view: A('img/hall-kamin-720.webp') }],
    },
    chef: {
      name: 'Шеф-стол', photo: A('img/hall-chefstol-720.webp'), setOnly: true,
      svg: `<g fill="none" stroke="currentColor" stroke-width="2"><path d="M10 10H990V690H10Z"/></g>
        <path d="M60 40h880v240H60z" fill="rgba(226,125,70,.08)" stroke="currentColor" stroke-dasharray="6 6"/>
        <path class="plan__fire" d="M200 90h170v80H200zM630 90h170v80H630z" stroke-width="2"/>
        <text x="500" y="230" text-anchor="middle">открытая кухня · гриль · печь</text>`,
      tables: [{ id: 'Ш', label: 'стойка', seats: 8, shape: 'long', x: 12, y: 47, w: 76, h: 9, where: 'стойка у открытой кухни', view: A('img/hall-chefstol-720.webp'), counter: true }],
    },
    terrasa: {
      name: 'Терраса', photo: A('img/hall-terrasa-720.webp'), season: [5, 9],
      svg: `<g fill="none" stroke="currentColor" stroke-width="2"><path d="M10 10H990V690H10Z" stroke-dasharray="10 8"/></g>
        <g fill="rgba(74,82,56,.45)"><circle cx="120" cy="120" r="70"/><circle cx="880" cy="580" r="80"/><circle cx="860" cy="110" r="55"/></g>
        <path d="M60 300Q500 380 940 300M60 500Q500 580 940 500" fill="none" stroke="rgba(242,203,142,.5)" stroke-dasharray="2 14" stroke-width="5" stroke-linecap="round"/>`,
      tables: [
        { id: 'Т1', seats: 4, shape: 'round', x: 26, y: 18, w: 10, h: 14.3, where: 'под липой', view: A('img/hall-terrasa-720.webp') },
        { id: 'Т2', seats: 4, shape: 'round', x: 46, y: 18, w: 10, h: 14.3, where: 'в центре террасы', view: A('img/hall-terrasa-720.webp') },
        { id: 'Т3', seats: 6, shape: 'long', x: 20, y: 60, w: 15, h: 11, where: 'под гирляндами', view: A('img/hall-terrasa-720.webp') },
        { id: 'Т4', seats: 6, shape: 'long', x: 45, y: 60, w: 15, h: 11, where: 'под гирляндами', view: A('img/hall-terrasa-720.webp') },
      ],
    },
  };

  // название и фото зала можно поменять в админке: они приходят в кнопках-вкладках (data-name, data-photo)
  root.querySelectorAll('[data-hall]').forEach((b) => {
    const h = HALLS[b.dataset.hall];
    if (!h) return;
    if (b.dataset.name) h.name = b.dataset.name;
    if (b.dataset.photo) h.photo = b.dataset.photo;
  });

  /* ---------- состояние ---------- */
  const params = new URLSearchParams(location.search);
  const st = {
    step: 1,
    guests: Math.min(8, Math.max(1, Number(params.get('guests')) || 2)),
    date: '',
    time: '',
    hall: HALLS[params.get('hall')] ? params.get('hall') : 'pech',
    table: null,
    any: false,
    set: params.get('set') === '1' || params.get('hall') === 'chef',
  };
  const pDate = params.get('date');
  if (pDate === 'today') st.date = iso(today);
  else if (pDate === 'tomorrow') { const t = new Date(today); t.setDate(t.getDate() + 1); st.date = iso(t); }
  else if (/^\d{4}-\d{2}-\d{2}$/.test(pDate || '')) st.date = pDate;
  if (st.date && (st.date < iso(today) || st.date > iso(lastDay))) st.date = '';
  if (LUNCH.includes(params.get('time')) || DINNER.includes(params.get('time'))) st.time = params.get('time');

  // сегодня нельзя выбрать время, до которого осталось меньше получаса
  const slotTaken = (date, time) => {
    if (date !== iso(today)) return false;
    const [h, m] = time.split(':').map(Number);
    const now = new Date();
    return h * 60 + m < now.getHours() * 60 + now.getMinutes() + 30;
  };
  const hallOpen = (key, date) => {
    const s = HALLS[key].season;
    if (!s || !date) return true;
    const m = Number(date.slice(5, 7));
    return m >= s[0] && m <= s[1];
  };
  // состояние стола: free | small (мало мест или зал для большой компании)
  const tableState = (key, t) => {
    if (t.seats < st.guests) return { s: 'small' };
    if (HALLS[key].minGuests && st.guests < HALLS[key].minGuests) return { s: 'small', min: HALLS[key].minGuests };
    return { s: 'free' };
  };

  /* ---------- сводка ---------- */
  const sumWhen = $('[data-sum-when]');
  const sumGuests = $('[data-sum-guests]');
  const sumWhere = $('[data-sum-where]');
  const sumPhoto = $('[data-sum-photo]');
  const guestsText = (n) => `${n} ${O.plural(n, 'гость', 'гостя', 'гостей')}`;
  const tableText = (key, t) => (t.counter ? `${t.where}` : `стол ${t.id}, ${t.where}, на ${t.seats}`);
  const setPhoto = (src) => {
    if (sumPhoto.getAttribute('src') === src) return;
    sumPhoto.style.opacity = '0';
    const img = new Image();
    img.src = src;
    img.decode().catch(() => {}).then(() => { sumPhoto.src = src; sumPhoto.style.opacity = '1'; });
  };
  const updateSummary = () => {
    sumWhen.textContent = st.date ? `${O.humanDate(st.date)}${st.time ? `, ${st.time}` : ''}` : '—';
    sumGuests.textContent = guestsText(st.guests);
    const hall = HALLS[st.hall];
    sumWhere.textContent = st.table ? `${hall.name}: ${tableText(st.hall, st.table)}` : st.any ? `${hall.name}, стол на выбор администратора` : 'выберите на шаге 2';
    setPhoto(st.table ? st.table.view : hall.photo);
  };

  /* ---------- шаг 1: гости ---------- */
  const out = $('[data-guests-out]');
  const minus = $('[data-guests="-1"]');
  const plus = $('[data-guests="1"]');
  const renderGuests = () => {
    out.textContent = st.guests;
    minus.disabled = st.guests <= 1;
    plus.disabled = st.guests >= 8;
  };
  $$('[data-guests]').forEach((b) => b.addEventListener('click', () => {
    st.guests = Math.min(8, Math.max(1, st.guests + Number(b.dataset.guests)));
    renderGuests();
    revalidateTable();
    updateSummary();
  }));

  /* ---------- шаг 1: календарь ---------- */
  const grid = $('[data-cal-grid]');
  const calTitle = $('[data-cal-title]');
  const prev = $('[data-cal-prev]');
  const next = $('[data-cal-next]');
  let view = st.date ? new Date(`${st.date}T12:00`) : new Date(today);
  view.setDate(1);
  const renderCal = () => {
    calTitle.textContent = `${MONTHS_NOM[view.getMonth()]} ${view.getFullYear()}`;
    const first = new Date(view);
    const pad = (first.getDay() + 6) % 7;   // неделя с понедельника
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    let html = '';
    for (let i = 0; i < pad; i++) html += '<span class="cal__pad"></span>';
    for (let d = 1; d <= days; d++) {
      const date = new Date(view.getFullYear(), view.getMonth(), d, 12);
      const v = iso(date);
      const off = v < iso(today) || v > iso(lastDay);
      html += `<button type="button" data-date="${v}" aria-label="${d} ${MONTHS[date.getMonth()]}"${off ? ' disabled' : ''} aria-pressed="${v === st.date}"${v === iso(today) ? ' class="is-today"' : ''}>${d}</button>`;
    }
    grid.innerHTML = html;
    const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    prev.disabled = view <= firstMonth;
    next.disabled = new Date(view.getFullYear(), view.getMonth() + 1, 1) > lastDay;
  };
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-date]');
    if (!b) return;
    st.date = b.dataset.date;
    if (st.time && slotTaken(st.date, st.time)) st.time = '';
    renderCal();
    renderSlots();
    revalidateTable();
    updateSummary();
    check1();
  });
  prev.addEventListener('click', () => { view.setMonth(view.getMonth() - 1); renderCal(); });
  next.addEventListener('click', () => { view.setMonth(view.getMonth() + 1); renderCal(); });

  /* ---------- шаг 1: время ---------- */
  const slotList = (box, times) => {
    box.innerHTML = times.map((t) => {
      const past = !!st.date && slotTaken(st.date, t);
      return `<button type="button" data-time="${t}" aria-pressed="${t === st.time}"${past ? ' disabled aria-label="' + t + ', время прошло"' : ''}>${t}</button>`;
    }).join('');
  };
  const renderSlots = () => { slotList($('[data-slots-lunch]'), LUNCH); slotList($('[data-slots-dinner]'), DINNER); };
  $('[data-slots]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-time]');
    if (!b) return;
    st.time = b.dataset.time;
    renderSlots();
    revalidateTable();
    updateSummary();
    check1();
  });
  const next1 = $('[data-next="2"]');
  const hint1 = $('[data-hint1]');
  const check1 = () => {
    const ok = st.date && st.time;
    next1.disabled = !ok;
    hint1.textContent = ok ? '' : !st.date ? 'Выберите дату' : 'Выберите время';
  };

  /* ---------- шаг 2: схема зала ---------- */
  const plan = $('[data-plan]');
  const info = $('[data-plan-info]');
  const tabs = $$('[data-hall]');
  const chairs = (t) => {
    // стулья вокруг стола — только для красоты схемы
    const cx = (t.x + t.w / 2) * 10, cy = (t.y + t.h / 2) * 7, w = t.w * 10, h = t.h * 7;
    let s = '';
    if (t.shape === 'round') {
      for (let i = 0; i < t.seats; i++) {
        const a = (i / t.seats) * Math.PI * 2 + Math.PI / 4;
        s += `<circle cx="${(cx + Math.cos(a) * (w / 2 + 16)).toFixed(1)}" cy="${(cy + Math.sin(a) * (h / 2 + 16)).toFixed(1)}" r="9"/>`;
      }
    } else {
      const side = t.counter ? t.seats : Math.ceil(t.seats / 2);
      for (let i = 0; i < side; i++) {
        const x = cx - w / 2 + (w / side) * (i + 0.5);
        s += `<circle cx="${x.toFixed(1)}" cy="${(cy + h / 2 + 18).toFixed(1)}" r="9"/>`;
        if (!t.counter && i < t.seats - side) s += `<circle cx="${x.toFixed(1)}" cy="${(cy - h / 2 - 18).toFixed(1)}" r="9"/>`;
      }
    }
    return s;
  };
  const describe = (key, t, state) => {
    const base = t.counter ? `Шеф-стол · ${t.where}` : `Стол ${t.id} · ${t.where} · на ${t.seats}`;
    if (state.s === 'small' && state.min) return `${base} — для компании от ${state.min} гостей`;
    if (state.s === 'small') return `${base} — мало мест для ${guestsText(st.guests)}`;
    if (t.counter) return `${base} — только сет шефа`;
    return base;
  };
  const renderPlan = () => {
    const key = st.hall;
    const hall = HALLS[key];
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.hall === key)));
    const open = hallOpen(key, st.date);
    let html = `<svg class="plan__svg" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true">${hall.svg}<g fill="none" stroke="currentColor" stroke-width="1.5">${hall.tables.map(chairs).join('')}</g></svg>`;
    html += hall.tables.map((t) => {
      const state = tableState(key, t);
      const cls = `table table--${t.shape}${state.s !== 'free' ? ` is-${state.s}` : ''}`;
      const label = describe(key, t, state);
      const dis = !open || state.s !== 'free';
      return `<button type="button" class="${cls}" style="left:${t.x}%;top:${t.y}%;width:${t.w}%;height:${t.h}%" data-table="${t.id}" aria-pressed="${!!st.table && st.table.id === t.id}" aria-label="${label}"${dis ? ' aria-disabled="true"' : ''}><span>${t.label || t.id}<small>${t.seats}&nbsp;${O.plural(t.seats, 'место', 'места', 'мест')}</small></span></button>`;
    }).join('');
    if (!open) html += '<div class="plan__closed"><b>Терраса откроется в&nbsp;мае</b><span>С&nbsp;мая по&nbsp;сентябрь&nbsp;— под липами и&nbsp;гирляндами</span></div>';
    plan.innerHTML = html;
    info.textContent = !open ? 'В этот день терраса закрыта — выберите другой зал.'
      : st.table ? `Ваш выбор: ${describe(key, st.table, tableState(key, st.table))}`
      : hall.setOnly ? 'За шеф-столом подают только сет «Вечер у огня».'
      : 'Выберите стол — администратор закрепит его за вами или предложит соседний.';
  };
  const findTable = (id) => HALLS[st.hall].tables.find((t) => String(t.id) === String(id));
  plan.addEventListener('click', (e) => {
    const b = e.target.closest('[data-table]');
    if (!b) return;
    const t = findTable(b.dataset.table);
    const state = tableState(st.hall, t);
    if (b.getAttribute('aria-disabled') === 'true') { info.textContent = describe(st.hall, t, state); return; }
    st.table = st.table && st.table.id === t.id ? null : t;
    st.any = false;
    if (st.table && HALLS[st.hall].setOnly) { st.set = true; setCheck.checked = true; }
    renderPlan();
    updateSummary();
  });
  const hoverInfo = (e) => {
    const b = e.target.closest('[data-table]');
    if (!b) return;
    const t = findTable(b.dataset.table);
    info.textContent = describe(st.hall, t, tableState(st.hall, t));
    if (tableState(st.hall, t).s === 'free') setPhoto(t.view);
  };
  plan.addEventListener('pointerover', hoverInfo);
  plan.addEventListener('focusin', hoverInfo);
  plan.addEventListener('pointerleave', () => { updateSummary(); renderInfoOnly(); });
  const renderInfoOnly = () => {
    if (st.table) info.textContent = `Ваш выбор: ${describe(st.hall, st.table, tableState(st.hall, st.table))}`;
  };
  tabs.forEach((b) => b.addEventListener('click', () => {
    if (st.hall === b.dataset.hall) return;
    st.hall = b.dataset.hall;
    st.table = null;
    st.any = false;
    renderPlan();
    updateSummary();
  }));
  const revalidateTable = () => {
    if (st.table && tableState(st.hall, st.table).s !== 'free') st.table = null;
    if (st.step === 2) renderPlan();
  };
  $('[data-any]').addEventListener('click', () => {
    if (!hallOpen(st.hall, st.date)) st.hall = 'pech';
    st.table = null;
    st.any = true;
    updateSummary();
    go(3);
  });

  /* ---------- шаги ---------- */
  const steps = $$('[data-step]');
  const navBtns = $$('[data-goto]');
  const go = (n) => {
    if (n === 3 && !st.table) {
      if (!hallOpen(st.hall, st.date)) { info.textContent = 'Терраса в этот день закрыта — выберите другой зал.'; return; }
      st.any = true;
    }
    st.step = n;
    steps.forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
    navBtns.forEach((b) => {
      const k = Number(b.dataset.goto);
      b.toggleAttribute('aria-current', k === n);
      if (k === n) b.setAttribute('aria-current', 'step');
      b.disabled = n === 4 || k > n;
      b.classList.toggle('is-done', k < n);
    });
    if (n === 2) renderPlan();
    updateSummary();
    const top = root.getBoundingClientRect().top + scrollY - 110;
    if (scrollY > top) scrollTo({ top, behavior: 'smooth' });
    const title = steps[n - 1].querySelector('.step__title');
    if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
  };
  navBtns.forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.goto))));
  $$('[data-next]').forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.next))));

  /* ---------- шаг 3: контакты и отправка ---------- */
  const form = $('[data-bron-form]');
  const status = form.querySelector('.form__status');
  const setCheck = form.querySelector('[data-set-check]');
  setCheck.checked = st.set;
  setCheck.addEventListener('change', () => { st.set = setCheck.checked; });
  form.querySelectorAll('[data-phone]').forEach(O.bindPhone);
  let number = '';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = O.validate(form);
    if (bad) { status.textContent = 'Проверьте поля, отмеченные красным.'; status.classList.add('is-error'); bad.focus(); return; }
    if (form.company.value) return;
    status.classList.remove('is-error');
    status.textContent = 'Отправляем…';
    const hall = HALLS[st.hall];
    const fields = {
      date: st.date, time: st.time, guests: st.guests,
      hall: hall.name,
      table: st.table ? (st.table.counter ? 'стойка шеф-стола' : `стол ${st.table.id} (${st.table.where})`) : '',
      set: st.set ? 'да' : '',
      name: form.name.value.trim(),
      phone: form.phone.value,
      occasionBron: form.occasion.value,
      comment: form.comment.value.trim(),
    };
    try {
      const r = await O.send('bron', fields, { consent: true, hp: '' });
      if (!r.ok) throw new Error(r.error || 'send');
      number = r.number;
      const doneText = $('[data-done-text]');
      const note = doneText.dataset.doneNote || 'Администратор позвонит или напишет в течение 15 минут, чтобы подтвердить бронь. Ночные заявки подтверждаем с 12:00.';
      doneText.textContent = `Заявка №${r.number}: ${O.humanDate(st.date)}, ${st.time}, ${guestsText(st.guests)}. ${note}`;
      if (O.demo) {
        const box = $('[data-tg]');
        box.innerHTML = '';
        const tg = document.createElement('div');
        tg.className = 'tg';
        tg.innerHTML = '<span class="tg__from">Бот «Ольха · заявки»</span>';
        const body = document.createElement('span');
        body.textContent = r.text;
        tg.append(body);
        box.append(tg);
        $('[data-done-demo]').hidden = false;
      }
      go(4);
    } catch {
      status.classList.add('is-error');
      status.textContent = `Не получилось отправить. Позвоните нам: ${O.phone}.`;
    }
  });

  /* ---------- «добавить в календарь»: файл .ics собирается прямо в браузере ---------- */
  $('[data-ics]').addEventListener('click', () => {
    const [y, m, d] = st.date.split('-');
    const [hh, mm] = st.time.split(':');
    const start = `${y}${m}${d}T${hh}${mm}00`;
    const endH = String(Math.min(23, Number(hh) + 2)).padStart(2, '0');
    const where = st.table ? tableText(st.hall, st.table) : 'стол на выбор администратора';
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Olkha//Bron//RU', 'BEGIN:VEVENT',
      `UID:olkha-${number}-${Date.now()}@olkha`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART;TZID=Europe/Moscow:${start}`,
      `DTEND;TZID=Europe/Moscow:${y}${m}${d}T${endH}${mm}00`,
      'SUMMARY:Ужин в «Ольхе»',
      'LOCATION:Москва\\, Ольховская улица',
      `DESCRIPTION:Бронь №${number}\\, ${guestsText(st.guests)}\\, ${HALLS[st.hall].name}: ${where}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    a.download = 'olkha-bron.ics';
    document.body.append(a);
    a.click();
    a.remove();
  });

  /* ---------- старт ---------- */
  renderGuests();
  renderCal();
  renderSlots();
  check1();
  updateSummary();
  if (st.date && st.time) go(2);   // пришли со строки брони на главной — сразу к выбору места
})();

/* ============ Вывеска — бот-анкета «Подбор сайта» ============ */
(() => {
  const ENDPOINT = 'api/brief.php';
  const TELEGRAM = 'https://t.me/'; // запасной канал, если сервер недоступен
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const TIERS = {
    1: { name: 'Визитка', support: '15 000', key: '25 000', term: '7–10 дней' },
    2: { name: 'Многостраничный сайт', support: '35 000', key: '55 000', term: '2–3 недели' },
    3: { name: 'Сайт с онлайн-записью', support: '70 000', key: '110 000', term: '3–5 недель' },
  };

  const STEPS = [
    { key: 'business', label: 'Бизнес', type: 'single', ask: 'Чем вы занимаетесь?',
      options: ['Кафе или кофейня', 'Ресторан', 'Пекарня или кондитерская', 'Салон или барбершоп', 'Автосервис', 'Магазин', 'Другое'] },
    { key: 'name', label: 'Название и город', type: 'text', ask: 'Как называется ваше место и в каком городе?',
      placeholder: 'Кофейня «Луна», Казань' },
    { key: 'features', label: 'Нужно на сайте', type: 'multi', ask: 'Что должно быть на сайте? Можно выбрать несколько.',
      options: ['Меню или прайс', 'Фотогалерея', 'Форма заявки', 'Бронь столика', 'Онлайн-запись к мастеру', 'Каталог и заказы', 'Несколько страниц', 'Посоветуйте вы'] },
    { key: 'style', label: 'Стиль', type: 'styles', ask: 'Какой стиль вам ближе?' },
    { key: 'colors', label: 'Цвета', type: 'palettes', ask: 'А какие цвета?' },
    { key: 'materials', label: 'Уже есть', type: 'multi', ask: 'Что у вас уже есть?',
      options: ['Логотип', 'Хорошие фото', 'Меню или прайс', 'Домен', 'Пока ничего'] },
    { key: 'format', label: 'Формат', type: 'single', ask: 'Как вам удобнее работать?',
      options: ['С поддержкой — дешевле на старте', 'Под ключ — всё моё, меняю сам', 'Пока не знаю'] },
    { key: 'deadline', label: 'Сроки', type: 'single', ask: 'Когда нужен сайт?',
      options: ['Как можно скорее', 'В течение месяца', 'Не горит'] },
    { key: 'wishes', label: 'Пожелания', type: 'text', optional: true,
      ask: 'Есть пожелания или сайт, который вам нравится? Этот вопрос можно пропустить.', placeholder: 'Например: хочу как у…' },
  ];

  const STYLES = [
    { id: 'warm', title: 'Тёплый и уютный', note: 'беж, дерево, мягкие формы' },
    { id: 'minimal', title: 'Светлый минимализм', note: 'воздух и строгий шрифт' },
    { id: 'bold', title: 'Яркий и смелый', note: 'сочные цвета, крупный текст' },
    { id: 'premium', title: 'Тёмный премиум', note: 'тёмный фон и золото' },
  ];

  const PALETTES = [
    { title: 'Из моего логотипа', colors: [] },
    { title: 'Тёплые', colors: ['#f3e3cf', '#c08552', '#5b3a29'] },
    { title: 'Свежие', colors: ['#f4f7f0', '#7fb069', '#2f4f3a'] },
    { title: 'Сочные', colors: ['#ffd23f', '#ee4266', '#3bceac'] },
    { title: 'Спокойные', colors: ['#eef2f6', '#7d9cb8', '#2d3e50'] },
    { title: 'На ваш вкус', colors: [] },
  ];

  // Уровень сайта по выбранным функциям
  const tierFor = (features) => {
    if (features.some((f) => /запись|Каталог/.test(f))) return 3;
    if (features.some((f) => /Бронь|Несколько страниц/.test(f)) || features.length >= 4) return 2;
    return 1;
  };

  /* ---------- Разметка ---------- */
  const root = document.createElement('div');
  root.className = 'brief';
  root.innerHTML = `
    <button class="brief__launcher" type="button" data-brief-open aria-haspopup="dialog">
      <span class="brief__pulse" aria-hidden="true"></span>Подобрать сайт
    </button>
    <section class="brief__panel" role="dialog" aria-label="Подбор сайта">
      <header class="brief__head">
        <span class="logo__mark" aria-hidden="true">В</span>
        <div class="brief__title"><strong>Подбор сайта</strong><span>2 минуты · бесплатный концепт</span></div>
        <button class="brief__icon" type="button" data-brief-restart aria-label="Начать заново" title="Начать заново">↺</button>
        <button class="brief__icon" type="button" data-brief-close aria-label="Закрыть" title="Закрыть">✕</button>
      </header>
      <div class="brief__progress" aria-hidden="true"><span></span></div>
      <div class="brief__log" aria-live="polite"></div>
      <div class="brief__controls"></div>
    </section>`;
  document.body.append(root);

  const panel = root.querySelector('.brief__panel');
  const launcher = root.querySelector('.brief__launcher');
  const log = root.querySelector('.brief__log');
  const controls = root.querySelector('.brief__controls');
  const bar = root.querySelector('.brief__progress span');

  /* ---------- Помощники ---------- */
  let session = 0;
  let answers = {};
  let startedAt = 0;

  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const scrollDown = () => log.scrollTo({ top: log.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  const setProgress = (part) => { bar.style.width = `${Math.round(part * 100)}%`; };

  const bubble = (who, content) => {
    const msg = el('div', `msg msg--${who}`);
    if (typeof content === 'string') msg.textContent = content;
    else msg.append(content);
    log.append(msg);
    scrollDown();
    return msg;
  };

  // Сообщение бота с «печатает…»
  const say = async (content, delay = 700) => {
    const typing = el('div', 'msg msg--bot msg--typing');
    typing.append(el('i'), el('i'), el('i'));
    log.append(typing);
    scrollDown();
    await wait(delay);
    typing.remove();
    return bubble('bot', content);
  };

  const chip = (label, cls = '') => {
    const b = el('button', `chip ${cls}`.trim(), label);
    b.type = 'button';
    return b;
  };

  const focusFirst = () => controls.querySelector('input:not([tabindex="-1"]), button')?.focus({ preventScroll: true });

  /* ---------- Ответы пользователя ---------- */
  const ask = (step) => new Promise((resolve) => {
    controls.replaceChildren();
    const done = (value, shown = value) => {
      controls.replaceChildren();
      bubble('user', shown);
      resolve(value);
    };

    if (step.type === 'single') {
      step.options.forEach((o) => {
        const b = chip(o);
        b.onclick = () => done(o);
        controls.append(b);
      });
    }

    if (step.type === 'multi') {
      const picked = new Set();
      const ok = chip('Готово →', 'chip--accent');
      ok.disabled = true;
      step.options.forEach((o) => {
        const b = chip(o);
        b.setAttribute('aria-pressed', 'false');
        b.onclick = () => {
          picked.has(o) ? picked.delete(o) : picked.add(o);
          b.classList.toggle('is-on', picked.has(o));
          b.setAttribute('aria-pressed', picked.has(o));
          ok.disabled = picked.size === 0;
        };
        controls.append(b);
      });
      ok.onclick = () => done([...picked], [...picked].join(', '));
      controls.append(ok);
    }

    if (step.type === 'text') {
      const form = el('form', 'brief-input');
      const input = el('input');
      input.placeholder = step.placeholder || '';
      input.maxLength = 300;
      input.setAttribute('aria-label', step.ask);
      const send = el('button', 'brief-send', '→');
      send.type = 'submit';
      send.setAttribute('aria-label', 'Отправить');
      form.append(input, send);
      form.onsubmit = (e) => {
        e.preventDefault();
        const v = input.value.trim();
        if (v) done(v);
        else if (!step.optional) input.focus();
      };
      controls.append(form);
      if (step.optional) {
        const skip = chip('Пропустить');
        skip.onclick = () => done('—', 'Пропустить');
        controls.append(skip);
      }
    }

    if (step.type === 'styles') {
      const grid = el('div', 'styles');
      STYLES.forEach((s) => {
        const card = el('button', 'style-card');
        card.type = 'button';
        const preview = el('span', `sp sp--${s.id}`);
        preview.append(el('i'), el('i'), el('i'), el('i'));
        card.append(preview, el('b', '', s.title), el('small', '', s.note));
        card.onclick = () => done(s.title);
        grid.append(card);
      });
      const trust = chip('Доверюсь вам');
      trust.onclick = () => done('На усмотрение дизайнера', 'Доверюсь вам');
      controls.append(grid, trust);
    }

    if (step.type === 'palettes') {
      PALETTES.forEach((p) => {
        const b = chip('');
        if (p.colors.length) {
          const sw = el('span', 'sw');
          p.colors.forEach((c) => { const dot = el('b'); dot.style.background = c; sw.append(dot); });
          b.append(sw);
        }
        b.append(p.title);
        b.onclick = () => done(p.title);
        controls.append(b);
      });
    }

    if (step.type === 'contact') {
      const form = el('form', 'brief-contact');
      form.innerHTML = `
        <input name="name" maxlength="100" placeholder="Как к вам обращаться?" aria-label="Имя" required>
        <input name="contact" maxlength="100" placeholder="Telegram (@ник) или телефон" aria-label="Telegram или телефон" required>
        <input name="website" class="brief-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <label class="consent"><input type="checkbox" name="consent" required>
          <span>Согласен на обработку данных по <a href="politika.html" target="_blank" rel="noopener">политике конфиденциальности</a></span></label>
        <button class="chip chip--accent" type="submit">Отправить анкету →</button>`;
      form.onsubmit = (e) => {
        e.preventDefault();
        const f = new FormData(form);
        done(
          { name: f.get('name').trim(), contact: f.get('contact').trim(), hp: f.get('website') },
          `${f.get('name').trim()} · ${f.get('contact').trim()}`
        );
      };
      controls.append(form);
    }

    focusFirst();
    // панель ответов могла стать выше — докручиваем переписку до последнего вопроса
    requestAnimationFrame(scrollDown);
  });

  /* ---------- Итог и отправка ---------- */
  const priceLines = (t) => {
    const f = answers.format || '';
    if (f.startsWith('С поддержкой')) return [`от ${t.support} ₽ + 3 500 ₽/мес`];
    if (f.startsWith('Под ключ')) return [`от ${t.key} ₽ разово`];
    return [`с поддержкой — от ${t.support} ₽ + 3 500 ₽/мес`, `под ключ — от ${t.key} ₽`];
  };

  const summaryCard = (t) => {
    const card = el('div', 'brief-sum');
    card.append(el('span', 'brief-sum__label', 'вам подойдёт'), el('strong', '', t.name));
    priceLines(t).forEach((line) => card.append(el('span', 'brief-sum__price', line)));
    card.append(
      el('span', 'brief-sum__term', `срок — ${t.term}`),
      el('span', 'brief-sum__note', 'Точную цену назову после короткой переписки. Первый экран сайта — бесплатно.')
    );
    return card;
  };

  const fieldsForSend = () => Object.fromEntries(
    STEPS.map((s) => [s.label, Array.isArray(answers[s.key]) ? answers[s.key].join(', ') : answers[s.key]])
  );

  const plainText = (t, contact) => [
    'Анкета с сайта «Вывеска»',
    ...Object.entries(fieldsForSend()).map(([k, v]) => `${k}: ${v}`),
    `Подходит: ${t.name}`,
    `Имя: ${contact.name}`,
    `Связь: ${contact.contact}`,
  ].join('\n');

  const send = async (payload) => {
    if (location.protocol === 'file:') throw new Error('Сайт открыт с диска — сервера нет');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
    } finally {
      clearTimeout(timer);
    }
  };

  // Если сервер недоступен — копируем анкету и открываем Telegram
  const fallback = async (text) => {
    await say('Не получилось отправить анкету автоматически. Нажмите кнопку: анкета скопируется, и откроется Telegram — просто вставьте её в сообщение.');
    const b = chip('Скопировать и открыть Telegram', 'chip--accent');
    b.onclick = async () => {
      try {
        await navigator.clipboard.writeText(text);
        b.textContent = 'Скопировано ✓ Открываю Telegram…';
      } catch {
        const area = el('textarea', 'brief-copy');
        area.value = text;
        area.readOnly = true;
        controls.append(area);
        area.select();
      }
      window.open(TELEGRAM, '_blank', 'noopener');
    };
    controls.replaceChildren(b);
  };

  /* ---------- Сценарий ---------- */
  const run = async () => {
    const id = ++session;
    const alive = () => id === session;
    answers = {};
    startedAt = Date.now();
    log.replaceChildren();
    controls.replaceChildren();
    setProgress(0);

    await say('Привет! Помогу подобрать сайт для вашего бизнеса — это займёт пару минут.', 400);
    if (!alive()) return;
    await say('В конце покажу примерную цену. А потом я бесплатно сделаю первый экран вашего будущего сайта — без предоплаты и обязательств.');
    if (!alive()) return;

    for (const [i, step] of STEPS.entries()) {
      setProgress(i / (STEPS.length + 1));
      await say(step.ask);
      if (!alive()) return;
      let value = await ask(step);
      if (!alive()) return;
      if (value === 'Другое') {
        await say('Расскажите в двух словах, чем занимаетесь.');
        if (!alive()) return;
        value = `Другое: ${await ask({ type: 'text', ask: 'Чем занимаетесь', placeholder: 'Например: студия керамики' })}`;
        if (!alive()) return;
      }
      answers[step.key] = value;
    }

    const tier = TIERS[tierFor(answers.features || [])];
    setProgress(STEPS.length / (STEPS.length + 1));
    await say('Вот что получается:');
    if (!alive()) return;
    await say(summaryCard(tier), 500);
    if (!alive()) return;
    await say('Куда прислать бесплатный концепт? Оставьте контакт — напишу в течение дня.');
    if (!alive()) return;
    const contact = await ask({ type: 'contact' });
    if (!alive()) return;

    const sending = await say('Отправляю…', 300);
    try {
      await send({
        fields: fieldsForSend(),
        tier: `${tier.name} · с поддержкой от ${tier.support} ₽ (+3 500 ₽/мес) · под ключ от ${tier.key} ₽`,
        name: contact.name,
        contact: contact.contact,
        hp: contact.hp,
        elapsed: Date.now() - startedAt,
        consent: true,
      });
      if (!alive()) return;
      sending.remove();
      setProgress(1);
      await say('Готово! Анкета у меня. Напишу вам в течение дня и пришлю бесплатный концепт первого экрана ✦');
    } catch {
      if (!alive()) return;
      sending.remove();
      setProgress(1);
      await fallback(plainText(tier, contact));
    }
  };

  /* ---------- Открыть / закрыть ---------- */
  let started = false;
  const open = () => {
    root.classList.add('is-open');
    document.documentElement.classList.add('brief-lock');
    if (!started) { started = true; run(); }
    setTimeout(focusFirst, 350);
  };
  const close = () => {
    root.classList.remove('is-open');
    document.documentElement.classList.remove('brief-lock');
    launcher.focus({ preventScroll: true });
  };

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-brief-open]')) { e.preventDefault(); open(); }
  });
  root.querySelector('[data-brief-close]').onclick = close;
  root.querySelector('[data-brief-restart]').onclick = () => { started = true; run(); };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('is-open')) close();
  });
})();

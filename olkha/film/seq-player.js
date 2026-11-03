/* Ганаш — покадровая анимация по прокрутке (как на страницах Apple).
   Полноэкранный <canvas> показывает один из ~200 заранее отрисованных кадров (WebP) в зависимости
   от прокрутки, между соседними кадрами — плавное смешивание. Классический скрипт без модулей
   и зависимостей: работает и с хостинга, и с диска (file://).

   const player = new SeqPlayer(canvas, {
     frames: 200,
     src: (i) => `seq/desk/${String(i).padStart(4, '0')}.webp`, // i — номер кадра с 1
     frameWidth: 1920, frameHeight: 1080,
     fit: 'cover',              // 'cover' — заполнить холст с обрезкой, 'contain' — вписать целиком
     focus: { x: 0.5, y: 0.5 }, // точка кадра, которую держим в центре при обрезке; можно (progress) => ({x, y})
     maxDpr: 2,                 // предел плотности пикселей холста
     concurrency: 10,           // одновременных загрузок (HTTP/2 — задержка на файл важнее скорости канала)
     background: '#130e0c',     // фон до первого кадра и поля в 'contain'; null — прозрачный холст
     crossfade: true,           // смешивать соседние кадры (по умолчанию выкл. при prefers-reduced-motion)
     preDecode: 4,              // сколько кадров впереди декодировать заранее
     onProgress: (loaded, total, failed) => {},
     onFirstFrame: () => {},
   });
   player.setProgress(p)    // 0…1 → позиция (frames − 1) · p; дробная часть смешивает два соседних кадра
   player.resize()          // пересчитать размер холста (вызывается и сам — ResizeObserver, resize)
   player.toScreen(nx, ny)  // точка кадра (0…1 от левого верхнего угла) → {x, y} в CSS-px от холста
   player.visibleRect()     // видимая часть кадра {x0, y0, x1, y1} в долях кадра
   player.loaded            // сколько кадров загружено
   player.destroy()

   Размер холста задаёт CSS (например, position: absolute; inset: 0; width: 100%; height: 100%),
   без padding и border. Атрибуты width/height плеер ставит сам: CSS-размер × min(devicePixelRatio, maxDpr).
   В памяти держим только <img> (сжатые кадры, ~100 КБ); растр браузер хранит и выгружает сам. */
(() => {
  'use strict';

  const IDLE = 0, LOADING = 1, LOADED = 2, FAILED = 3; // загрузка кадра
  const DECODING = 1, DECODED = 2;                     // декодирование (0 — не начато / отметка снята)
  const AHEAD = 8, BEHIND = 2;                         // окно приоритетной загрузки вокруг текущего кадра (в шагах прохода)
  const GAP = 8;                                       // смешиваем загруженные кадры не дальше друг от друга
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  // Положение кадра по одной оси: фокус — в центр холста, но без пустых полей;
  // если кадр меньше холста ('contain') — по центру.
  const place = (c, d, f) => (d <= c ? (c - d) / 2 : clamp(c / 2 - f * d, c - d, 0));

  // Фоновый порядок «от грубого к точному»: 1-й кадр, каждый 32-й (и последний), 16-й, 8-й, 4-й, 2-й,
  // затем все — прокрутка показывает похожий кадр задолго до полной загрузки. steps[j] — шаг прохода,
  // к которому относится order[j].
  const coarseToFine = (n) => {
    const order = [], steps = [], seen = new Uint8Array(n);
    const add = (i, s) => { if (!seen[i]) { seen[i] = 1; order.push(i); steps.push(s); } };
    add(0, 32);
    for (let step = 32; step >= 1; step >>= 1) {
      for (let i = 0; i < n; i += step) add(i, step);
      add(n - 1, step);
    }
    return { order, steps };
  };

  class SeqPlayer {
    constructor(canvas, opts) {
      const o = this.opts = Object.assign({
        frames: 1, frameWidth: 1920, frameHeight: 1080, fit: 'cover', focus: { x: 0.5, y: 0.5 },
        maxDpr: 2, concurrency: 10, background: '#130e0c', preDecode: 4,
      }, opts);
      if (typeof o.src !== 'function') throw new TypeError('SeqPlayer: нужен opts.src(i)');
      if (o.crossfade === undefined) {
        o.crossfade = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
      }
      this._opaque = !!o.background && o.background !== 'transparent';
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: !this._opaque });
      if (!this.ctx) throw new Error('SeqPlayer: холст уже занят другим контекстом');

      const n = this._n = Math.max(1, o.frames | 0);
      this._imgs = new Array(n);
      this._state = new Uint8Array(n);   // IDLE / LOADING / LOADED / FAILED
      this._tries = new Uint8Array(n);   // повторы после сбоя загрузки
      this._dec = new Uint8Array(n);     // 0 / DECODING / DECODED
      this._decList = [];                // кадры с ненулевым _dec (их немного — окно вокруг позиции)
      ({ order: this._order, steps: this._steps } = coarseToFine(n));
      this._orderAt = 0;
      this._step = 1;                    // шаг текущего прохода загрузки
      this.loaded = 0;
      this._failed = 0;
      this._active = 0;                  // загрузок в работе
      this._progress = 0;
      this._pos = 0;                     // позиция в кадрах, 0…n−1
      this._dir = 1;                     // направление прокрутки
      this._moved = false;               // пользователь уже двигал прокрутку
      this._cw = this._ch = 0;           // CSS-размер холста
      this._drawn = null;                // что нарисовано сейчас (чтобы не перерисовывать то же самое)
      this._raf = 0;
      this._posterDone = false;
      this._first = false;
      this._destroyed = false;
      this._paused = !!document.hidden;

      this._tick = () => { this._raf = 0; this._render(); };
      this._onResize = () => this.resize();
      this._onVisibility = () => { this._paused = !!document.hidden; this._pump(); this._schedule(); };
      this._onRestore = () => { this._drawn = null; this._schedule(); }; // холст очищен после потери контекста
      document.addEventListener('visibilitychange', this._onVisibility);
      window.addEventListener('resize', this._onResize); // смена масштаба (devicePixelRatio), поворот
      canvas.addEventListener('contextrestored', this._onRestore);
      if (window.ResizeObserver) {
        this._ro = new ResizeObserver(this._onResize);
        this._ro.observe(canvas);
      }
      this.resize();
      this._pump();
    }

    /* ---------- публичное API ---------- */

    setProgress(p) {
      const progress = clamp(+p || 0, 0, 1);
      if (progress === this._progress) return;
      this._dir = progress > this._progress ? 1 : -1;
      this._progress = progress;
      this._pos = progress * (this._n - 1);
      this._moved = true;
      this._schedule(); // перерисовка — одна на кадр экрана
      this._pump();     // освободившиеся загрузки сразу возьмут кадры рядом с новой позицией
    }

    resize() {
      if (this._destroyed) return;
      const c = this.canvas, cw = c.clientWidth, ch = c.clientHeight;
      if (!cw || !ch) { this._cw = this._ch = 0; return; } // холст скрыт — ждём, пока появится
      const dpr = Math.min(window.devicePixelRatio || 1, this.opts.maxDpr);
      const w = Math.max(1, Math.round(cw * dpr)), h = Math.max(1, Math.round(ch * dpr));
      this._cw = cw;
      this._ch = ch;
      if (c.width !== w || c.height !== h) {
        c.width = w; // очищает холст
        c.height = h;
        this._drawn = null;
      }
      this._render(); // сразу, в этом же кадре — иначе мелькнёт пустой холст
    }

    toScreen(nx, ny) {
      const L = this._layout();
      return L ? { x: L.ox + nx * L.dw, y: L.oy + ny * L.dh } : { x: 0, y: 0 };
    }

    visibleRect() {
      const L = this._layout();
      if (!L) return { x0: 0, y0: 0, x1: 1, y1: 1 };
      return {
        x0: clamp(-L.ox / L.dw, 0, 1), y0: clamp(-L.oy / L.dh, 0, 1),
        x1: clamp((L.cw - L.ox) / L.dw, 0, 1), y1: clamp((L.ch - L.oy) / L.dh, 0, 1),
      };
    }

    destroy() {
      if (this._destroyed) return;
      this._destroyed = true;
      cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect();
      window.removeEventListener('resize', this._onResize);
      document.removeEventListener('visibilitychange', this._onVisibility);
      this.canvas.removeEventListener('contextrestored', this._onRestore);
      this._imgs.forEach((img, k) => { // прерываем незавершённые загрузки
        if (img && this._state[k] === LOADING) { img.onload = img.onerror = null; img.removeAttribute('src'); }
      });
      this._imgs = [];
      this._decList = [];
    }

    /* ---------- загрузка ---------- */

    _pump() {
      if (this._destroyed || (this._paused && this._posterDone)) return; // вкладка скрыта — пауза
      const limit = this._posterDone ? Math.max(1, this.opts.concurrency | 0) : 1; // сначала только постер
      for (;;) {
        const k = this._next();
        // два соседа текущей позиции в текущем проходе — срочные: после прыжка не ждут, пока докачаются
        // дальние кадры, а занимают до двух слотов сверх лимита (и получают высокий приоритет загрузки)
        const urgent = this._moved && Math.abs(k - this._pos) < this._step;
        if (k < 0 || this._active >= limit + (urgent ? 2 : 0)) return;
        this._load(k, urgent);
      }
    }

    // Следующий кадр для загрузки — в порядке «от грубого к точному», но внутри текущего прохода сперва
    // кадры у позиции (больше — по ходу прокрутки): у зрителя кадры густеют раньше, чем везде, и прокрутка
    // не упирается в непрерывную докачку подряд, пока дальше по ходу кадров нет вовсе.
    _next() {
      const n = this._n, st = this._state;
      while (this._orderAt < n && st[this._order[this._orderAt]] !== IDLE) this._orderAt++;
      if (this._orderAt >= n) return -1;
      const s = this._step = this._steps[this._orderAt];
      if (this._moved) {
        const c = Math.round(this._pos / s) * s, dir = this._dir;
        for (let d = 0; d <= AHEAD; d++) {
          const a = c + d * s * dir, b = c - d * s * dir;
          if (a >= 0 && a < n && st[a] === IDLE) return a;
          if (d && d <= BEHIND && b >= 0 && b < n && st[b] === IDLE) return b;
        }
      }
      return this._order[this._orderAt];
    }

    _load(k, urgent) {
      const img = new Image();
      img.decoding = 'async';
      if (k === 0 || urgent) img.fetchPriority = 'high';
      this._imgs[k] = img;
      this._state[k] = LOADING;
      this._active++;
      const done = (ok) => {
        img.onload = img.onerror = null;
        if (this._destroyed) return;
        this._active--;
        this._posterDone = true;
        if (ok) { this._state[k] = LOADED; this.loaded++; }
        else if (this._tries[k] < 2) { // сбой сети или 503 у хостинга: ещё две попытки с паузой, кадр пока «в загрузке»
          this._imgs[k] = null;
          setTimeout(() => { if (!this._destroyed) this._load(k, false); }, 1500 * ++this._tries[k]);
        }
        else { this._state[k] = FAILED; this._imgs[k] = null; this._failed++; } // 404 и т. п.: рисуем соседей
        this._pump();
        if (ok) this._schedule(); // новый кадр может оказаться ближе к нужному
        if (this.opts.onProgress) this.opts.onProgress(this.loaded, this._n, this._failed);
      };
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = this.opts.src(k + 1) || '';
    }

    /* ---------- декодирование ---------- */

    // Декодируем кадр в фоне, чтобы drawImage не декодировал его синхронно (рывок прокрутки).
    _decode(k) {
      if (this._state[k] !== LOADED || this._dec[k]) return;
      const img = this._imgs[k];
      const ready = () => {
        if (this._destroyed || this._dec[k] !== DECODING) return;
        this._dec[k] = DECODED;
        this._schedule();
      };
      this._dec[k] = DECODING;
      this._decList.push(k);
      if (!img.decode) return ready();
      img.decode().then(ready, () => {
        if (img.naturalWidth) return ready(); // decode() капризничает, но картинка цела — нарисуем как есть
        if (this._destroyed) return;
        this._state[k] = FAILED; this._imgs[k] = null; this._dec[k] = 0;
        this.loaded--; this._failed++;
        this._schedule();
      });
    }

    // Окно предекода вокруг позиции (вперёд по ходу прокрутки — больше) плюс кадр want, который хотим
    // показать. У остальных далёких кадров отметку «декодирован» снимаем (кроме тех, что на экране):
    // браузер сам выгрузит их растр из памяти, а при возврате decode() вызовется снова.
    _decodeAround(i0, i1, want) {
      const r = Math.max(1, this.opts.preDecode | 0), back = Math.ceil(r / 2), n = this._n;
      const lo = Math.max(0, i0 - (this._dir > 0 ? back : r));
      const hi = Math.min(n - 1, i1 + (this._dir > 0 ? r : back));
      for (let k = lo; k <= hi; k++) this._decode(k);
      if (want >= 0) this._decode(want);
      const d = this._drawn, dec = this._dec;
      this._decList = this._decList.filter((k) => {
        const keep = (k >= lo - r && k <= hi + r) || k === want || (d && (k === d.a || k === d.b));
        if (dec[k] === DECODED && !keep) dec[k] = 0;
        return dec[k] !== 0;
      });
    }

    // Первый загруженный кадр от from в сторону step (±1) не дальше GAP кадров; −1 — такого нет.
    _scan(from, step) {
      for (let k = from, d = 0; d <= GAP && k >= 0 && k < this._n; k += step, d++) {
        if (this._state[k] === LOADED) return k;
      }
      return -1;
    }

    // Ближайший к кадру t кадр, у которого arr[i] === val; при равенстве — в сторону s (±1).
    _nearest(t, s, arr, val) {
      const n = this._n;
      for (let d = 0; d < n; d++) {
        const a = t + d * s, b = t - d * s;
        if (a >= 0 && a < n && arr[a] === val) return a;
        if (d && b >= 0 && b < n && arr[b] === val) return b;
      }
      return -1;
    }

    /* ---------- отрисовка ---------- */

    _schedule() {
      if (!this._raf && !this._destroyed) this._raf = requestAnimationFrame(this._tick);
    }

    // Геометрия кадра на холсте в CSS-px: смещение (ox, oy) и размер (dw, dh).
    _layout() {
      const cw = this._cw, ch = this._ch, o = this.opts;
      if (!cw || !ch) return null;
      const s = (o.fit === 'contain' ? Math.min : Math.max)(cw / o.frameWidth, ch / o.frameHeight);
      const dw = o.frameWidth * s, dh = o.frameHeight * s;
      const f = (typeof o.focus === 'function' ? o.focus(this._progress) : o.focus) || {};
      return {
        cw, ch, dw, dh,
        ox: place(cw, dw, f.x == null ? 0.5 : +f.x),
        oy: place(ch, dh, f.y == null ? 0.5 : +f.y),
      };
    }

    _render() {
      if (this._destroyed) return;
      const L = this._layout();
      if (!L) return;
      const n = this._n, pos = this._pos, dec = this._dec;
      const i0 = Math.min(Math.floor(pos), n - 1), i1 = Math.min(i0 + 1, n - 1);
      // Загруженные кадры по обе стороны от позиции. Пока промежуточные докачиваются, смешиваем
      // ближайшие загруженные — прокрутка плавная задолго до полной загрузки.
      let lo = this._scan(i0, -1), hi = i1 > i0 ? this._scan(i1, 1) : -1;
      if (lo < 0 || hi < 0 || hi - lo > GAP) lo = hi = -1;
      let q = lo >= 0 ? Math.round((pos - lo) / (hi - lo) * 255) : 0; // вес второго кадра, 0…255
      const t = Math.round(pos), s = pos >= t ? 1 : -1;     // ближайший к позиции кадр и «вторая» сторона
      // нужного кадра нет — ближайший загруженный
      const want = lo >= 0 ? (q < 128 ? lo : hi) : this._nearest(t, s, this._state, LOADED);
      this._decodeAround(lo >= 0 ? lo : i0, lo >= 0 ? hi : i1, want);
      let a = want, b = -1;
      if (this.opts.crossfade && q > 0 && q < 255 && dec[lo] === DECODED && dec[hi] === DECODED) {
        a = lo; b = hi; // оба соседа готовы — смешиваем
      } else {
        // want ещё декодируется в фоне — пока рисуем ближайший готовый (обычно тот, что уже на экране)
        if (a >= 0 && dec[a] !== DECODED) a = this._nearest(t, s, dec, DECODED);
        q = 0;
      }
      const d = this._drawn;
      if (d && d.a === a && d.b === b && d.q === q && d.ox === L.ox && d.oy === L.oy && d.dw === L.dw && d.dh === L.dh) return;
      if (a < 0 && d && d.a >= 0) return; // ничего готового нет — оставляем то, что уже на холсте
      this._draw(a, b, q, L);
    }

    _draw(a, b, q, L) {
      const c = this.canvas, ctx = this.ctx, o = this.opts;
      const sx = c.width / L.cw, sy = c.height / L.ch; // CSS-px → пиксели холста
      ctx.globalAlpha = 1;
      if (this._opaque) { ctx.fillStyle = o.background; ctx.fillRect(0, 0, c.width, c.height); }
      else ctx.clearRect(0, 0, c.width, c.height);
      if (a >= 0) {
        const x = L.ox * sx, y = L.oy * sy, w = L.dw * sx, h = L.dh * sy;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(this._imgs[a], x, y, w, h);
        if (b >= 0) {
          ctx.globalAlpha = q / 255;
          ctx.drawImage(this._imgs[b], x, y, w, h);
          ctx.globalAlpha = 1;
        }
      }
      this._drawn = { a, b, q, ox: L.ox, oy: L.oy, dw: L.dw, dh: L.dh };
      if (a >= 0 && !this._first) {
        this._first = true;
        if (o.onFirstFrame) o.onFirstFrame();
      }
    }
  }

  window.SeqPlayer = SeqPlayer;
})();

/* Ольха — внутренние страницы: переключение фото в галереях залов */
(() => {
  'use strict';

  document.querySelectorAll('[data-gallery]').forEach((gallery) => {
    const main = gallery.querySelector('[data-gallery-main]');
    const thumbs = [...gallery.querySelectorAll('.gallery__thumbs button')];
    thumbs.forEach((btn) => {
      btn.setAttribute('aria-label', `Показать: ${btn.dataset.alt}`);
      btn.addEventListener('click', () => {
        if (btn.getAttribute('aria-pressed') === 'true') return;
        thumbs.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        main.style.opacity = '0';
        const next = new Image();
        next.src = btn.dataset.src;
        next.decode().catch(() => {}).then(() => {
          main.src = btn.dataset.src;
          main.alt = btn.dataset.alt;
          main.style.opacity = '1';
        });
      });
    });
  });
})();

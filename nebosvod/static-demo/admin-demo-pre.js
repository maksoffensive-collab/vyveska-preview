/* Демо-админка «Небосвода»: заглушка сервера. Подключается первой в <head>.
   Запросы WordPress к серверу (admin-ajax, REST, загрузка файлов) получают ответ «успешно, пусто» — ничего никуда не уходит. */
(() => {
  const fake = /admin-ajax\.php|\/wp-json\/|[?&]rest_route=|async-upload\.php|admin-post\.php|\/wp-admin\/post\.php/;
  const body = '{"success":true,"data":{}}';
  const X = XMLHttpRequest.prototype, open = X.open, send = X.send;
  X.open = function (method, url, ...rest) {
    this.__nbFake = fake.test(String(url));
    return open.call(this, method, this.__nbFake ? location.href : url, ...rest);
  };
  X.send = function (data) {
    if (!this.__nbFake) return send.call(this, data);
    const x = this;
    const def = (k, v) => Object.defineProperty(x, k, { value: v, configurable: true });
    def('readyState', 4); def('status', 200); def('statusText', 'OK'); def('responseText', body); def('response', body);
    x.getAllResponseHeaders = () => 'content-type: application/json\r\n';
    x.getResponseHeader = (h) => (/content-type/i.test(h) ? 'application/json' : null);
    setTimeout(() => {
      if (typeof x.onreadystatechange === 'function') x.onreadystatechange();
      x.dispatchEvent(new Event('readystatechange'));
      if (typeof x.onload === 'function') x.onload();
      x.dispatchEvent(new Event('load'));
      x.dispatchEvent(new Event('loadend'));
    }, 30);
  };
  const f0 = window.fetch.bind(window);
  window.fetch = (input, init) => (fake.test(String((input && input.url) || input))
    ? Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }))
    : f0(input, init));
  if (navigator.sendBeacon) navigator.sendBeacon = () => true;
  window.onbeforeunload = null; // WordPress спрашивает «уйти со страницы?» при несохранённых правках — в демо не нужно
  window.addEventListener('beforeunload', (e) => e.stopImmediatePropagation(), true);
})();

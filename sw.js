/* Service worker do Pede Sul (copiado do Aterrisse).
   Sempre busca a versão nova na rede; a cópia guardada só é usada se estiver sem internet.
   Pedidos e dados do Supabase NUNCA são guardados aqui. */
var CACHE = 'pedesul-v2';  // v2 (22/11/2026): sempre confere com o servidor se há versão nova (sem esperar a cópia guardada)
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // no-cache = pergunta ao servidor se mudou (rápido); só usa a cópia guardada sem internet
  var nova = req.mode === 'navigate' ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(req, { cache: 'no-cache' });
  e.respondWith(fetch(nova).then(function (resp) {
    if (resp.ok) { var copia = resp.clone(); caches.open(CACHE).then(function (c) { c.put(req, copia); }); }
    return resp;
  }).catch(function () { return caches.match(req); }));
});
/* endereco-proprio-20261120 */

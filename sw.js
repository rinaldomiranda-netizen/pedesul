/* Service worker do Pede Sul (copiado do Aterrisse).
   Sempre busca a versão nova na rede; a cópia guardada só é usada se estiver sem internet.
   Pedidos e dados do Supabase NUNCA são guardados aqui. */
var CACHE = 'pedesul-v1';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (resp) {
    if (resp.ok) { var copia = resp.clone(); caches.open(CACHE).then(function (c) { c.put(req, copia); }); }
    return resp;
  }).catch(function () { return caches.match(req); }));
});

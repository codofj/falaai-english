/* FalaAí English — Service Worker (uso offline)
 * Estratégia: "stale-while-revalidate" para tudo do mesmo domínio.
 *  - responde na hora com o que está no cache (funciona sem internet);
 *  - se houver internet, atualiza o cache em segundo plano.
 * Para publicar uma nova versão do app, aumente CACHE_VERSION. */
const CACHE_VERSION = 'falaai-v1';
const CACHE_NAME = `falaai-english-${CACHE_VERSION}`;

// Essencial: se falhar, a instalação falha.
const CORE = ['./'];

// Opcionais: se algum não existir, é ignorado (não quebra a instalação).
const OPTIONAL = [
  './index.html',
  './assets/palavras.json',
  './assets/conversacao.json',
  './assets/manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE);
    await Promise.allSettled(OPTIONAL.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith('falaai-english-') && k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // só arquivos do próprio app

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: true });

    const network = fetch(req)
      .then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(network);          // atualiza em segundo plano
      return cached;
    }

    const res = await network;
    if (res) return res;

    // Sem cache e sem internet: para páginas, devolve o app salvo.
    if (req.mode === 'navigate') {
      const shell = (await cache.match('./index.html')) || (await cache.match('./'));
      if (shell) return shell;
    }
    return new Response('Sem conexão.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  })());
});

/* Network-first for HTML, JSON and the manifest so a new edition shows up.
   Cache-first for icons, CSS, fonts and scripts. Visited documents stay readable offline. */
const CACHE = 'ecuador-brief-v1';
const SCOPE_PATH = '/ecuador-brief';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function inScope(pathname) {
  return pathname === SCOPE_PATH || pathname.startsWith(`${SCOPE_PATH}/`);
}

function wantsNetworkFirst(request, url) {
  return (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('/')
  );
}

async function store(request, response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return;
  if (request.headers.get('range')) return;
  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  } catch {
    // A full cache or a redirected response should not break the page.
  }
}

async function networkFirstResponse(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    await store(request, fresh);
    return fresh;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    return new Response(
      'Sin conexión. Abre esta edición al menos una vez con red para leerla sin conexión.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }
}

async function cacheFirstResponse(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const fresh = await fetch(request);
  await store(request, fresh);
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!inScope(url.pathname)) return;
  if (url.pathname.endsWith('/sw.js')) return;
  event.respondWith(
    wantsNetworkFirst(request, url) ? networkFirstResponse(request) : cacheFirstResponse(request),
  );
});

// PWA + OneSignal Combined Service Worker
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
} catch (e) {
  console.warn('OneSignal SW failed to load:', e);
}

const CACHE_NAME = 'mybuilding-cache-v17';
const APP_SHELL = [
  '/',
  '/index.html',
  '/auth.html',
  '/admin.html',
  '/faults.html',
  '/community.html',
  '/notices.html',
  '/profile.html',
  '/manifest.json',
  '/theme-boost.css',
  '/supabase.js',
  '/pwa.js',
  '/icons/icon-192-v4.png',
  '/icons/icon-512-v4.png',
  '/icons/app-logo-cropped.png',
  '/icons/source-app-image.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => Promise.resolve())
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const pathname = requestUrl.pathname || '';
  const isHtmlNavigation =
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html');
  // config.js must NEVER be cached - it is generated at build time with secrets
  const isNeverCache = pathname === '/config.js';

  const isDynamicScript =
    pathname === '/supabase.js' ||
    pathname === '/push.js' ||
    pathname === '/pwa.js';

  // config.js always fetched from network - never serve from cache
  if (isNeverCache) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('window.APP_CONFIG={};', { headers: { 'Content-Type': 'application/javascript' } }))
    );
    return;
  }

  // Always prefer network for HTML so production updates appear immediately.
  if (isHtmlNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  if (isDynamicScript) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((networkResponse) => {
          if (requestUrl.origin !== self.location.origin) return networkResponse;
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});

// PWA + OneSignal Combined Service Worker

// ── Push notification display ──────────────────────────────────────────
// We intercept the push event BEFORE OneSignal's SW loads and handle
// notification display ourselves.  This guarantees:
//   1. Every notification gets a unique browser tag → no overwriting
//   2. We control the title / body / icon consistently
//
// OneSignal's SW is still imported so its SDK communication channel
// (subscription management, external-id aliasing, tagging) keeps working.

self.addEventListener('push', function (event) {
  // Stop OneSignal's handler from showing a duplicate notification
  event.stopImmediatePropagation();

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    try { data = JSON.parse(event.data ? event.data.text() : '{}'); } catch (_) { /* empty */ }
  }

  // OneSignal payload may nest fields; try common locations
  const title = data.title || (data.headings && (data.headings.he || data.headings.en)) || 'הודעה חדשה';
  const body  = data.alert || (data.contents && (data.contents.he || data.contents.en)) || '';
  const icon  = data.icon  || data.big_picture || '/icons/icon-192-v4.png';
  const url   = data.url   || data.launchURL   || data.launch_url || '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: icon,
      badge: '/icons/icon-192-v4.png',
      tag: 'n-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
      renotify: true,
      data: { url: url }
    })
  );
});

// Handle notification clicks — open the URL that came with the push.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.indexOf(self.location.origin) === 0 && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Import OneSignal SW — its push handler will NOT fire (stopImmediatePropagation)
// but the rest of its SDK communication stays active (subscription, tags, aliasing).
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
} catch (e) {
  console.warn('OneSignal SW failed to load:', e);
}

// ── PWA cache ──────────────────────────────────────────────────────────
const CACHE_NAME = 'mybuilding-cache-v20';
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

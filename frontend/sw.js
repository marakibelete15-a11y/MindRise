'use strict';

const CACHE_NAME = 'mindrise-shell-v1';
const PRECACHE_URLS = [
  './manifest.json',
  './pages/welcome.html',
  './pages/crisis.html',
  './pages/offline.html',
  './data/crisis-resources.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(async () => {
    const cache = await caches.open(CACHE_NAME);
    return cache.match('./pages/offline.html');
  }));
});
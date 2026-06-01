const CACHE_NAME = 'pracomer-v1';
const ASSETS = [
  '/',
  '/index.html',
  'https://cdn-icons-png.flaticon.com/512/5787/5787016.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
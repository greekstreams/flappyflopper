const CACHE_NAME = 'flappy-flopper-v1';
const CACHE_PREFIX = 'flappy-flopper-';
const STATIC_ASSETS = [
    './',
    './index.html',
    './about.html',
    './privacy.html',
    './style.css',
    './game.js',
    './sw.js',
    './manifest.json',
    './favicon.ico',
    './favicon-16x16.png',
    './favicon-32x32.png',
    './apple-touch-icon.png',
    './android-chrome-192x192.png',
    './android-chrome-512x512.png',
    './basketball-court-full.jpg',
    './obstacle_bottom.png',
    './obstacle_top.png',
    './social-preview.jpg',
    './vezenkov.png',
    './sounds/crash.mp3',
    './sounds/flap.mp3',
    './sounds/music.mp3',
    './sounds/score.mp3'
];

self.addEventListener('install', event => {
    event.waitUntil(Promise.all([
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)),
        self.skipWaiting()
    ]));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(cacheName => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
                    .map(cacheName => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const requestUrl = new URL(request.url);

    if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(request, { ignoreSearch: true }).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;

            return fetch(request)
                .then(response => {
                    if (!response.ok || response.type !== 'basic') return response;

                    return caches.open(CACHE_NAME)
                        .then(cache => cache.put(request, response.clone()).catch(() => {}))
                        .then(() => response);
                })
                .catch(() => request.mode === 'navigate'
                    ? caches.match('./index.html')
                    : Response.error());
        })
    );
});

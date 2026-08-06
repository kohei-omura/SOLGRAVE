/* SOLGRAVE ── Service Worker
   自前資産は Cache First、CDN(three.js)は Stale-While-Revalidate */
const CACHE = 'solgrave-v7';
const CDN = 'solgrave-cdn-v7';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/audio.js',
  './js/boss.js',
  './js/coffin.js',
  './js/enemy.js',
  './js/gfx.js',
  './js/main.js',
  './js/menu.js',
  './js/miko.js',
  './js/player.js',
  './js/purifier.js',
  './js/save.js',
  './js/solar.js',
  './js/stats.js',
  './js/sun.js',
  './js/ui.js',
  './js/world.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.all(ASSETS.map(u => c.add(u).catch(() => {})))
  ).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.map(k => (k === CACHE || k === CDN) ? null : caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 天気APIは常にネットワーク（キャッシュしない）
  if (url.hostname.indexOf('open-meteo') >= 0) return;

  // CDN：まずキャッシュを返しつつ裏で更新
  if (url.origin !== location.origin) {
    e.respondWith(caches.open(CDN).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()).catch(() => {});
        return res;
      }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  // 自前：Cache First
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && res.status === 200) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy).catch(() => {}));
    }
    return res;
  }).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : new Response('', { status: 503 }))));
});

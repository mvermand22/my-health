// Service worker: houdt de app zelf beschikbaar zonder internet.
// Verhoog VERSIE na elke wijziging aan de bestanden, zodat toestellen de nieuwe versie ophalen.
const VERSIE = 'hoofdpijn-v1';
const BESTANDEN = [
  './',
  './index.html',
  './app.js',
  './logic.js',
  './style.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSIE).then((c) => c.addAll(BESTANDEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((sleutels) => Promise.all(sleutels.filter((k) => k !== VERSIE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Alleen eigen bestanden; verzoeken naar Google gaan altijd rechtstreeks naar het netwerk.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Netwerk eerst (altijd de nieuwste versie), cache als je offline bent.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const kopie = res.clone();
          caches.open(VERSIE).then((c) => c.put(e.request, kopie));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});

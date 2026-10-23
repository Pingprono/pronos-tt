// Service worker minimal pour SPIN.
// Rôle : (1) rendre le site "installable" sur mobile, (2) garder une version
// de la page en cache pour qu'elle s'ouvre même sans réseau (juste la page :
// les données des matchs, elles, ont toujours besoin d'internet pour se
// charger depuis Supabase), (3) afficher les rappels envoyés par le robot.
const CACHE = 'spin-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(new Request('./', { cache: 'reload' })))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // On ne met en cache que la page elle-même, jamais les appels à Supabase :
  // les pronostics doivent toujours venir du réseau, pas d'une vieille copie.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((res) => res || caches.match('./')))
  );
});

// Rappels : le robot envoie { title, body, tag, url } ; on l'affiche tel quel.
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'SPIN', {
    body: d.body || '',
    icon: 'icon-192.png',
    tag: d.tag || 'spin',
    data: { url: d.url || './' },
  }));
});

// Toucher le rappel : on revient sur SPIN (l'onglet déjà ouvert, sinon un nouveau).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});

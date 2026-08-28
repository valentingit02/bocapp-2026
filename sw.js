/* Service Worker · cache para carga rapida y uso offline en iPhone */
const CACHE = "boca-2026-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./assets/style.css",
  "./assets/app.js",
  "./manifest.json",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

// Instala y cachea el "esqueleto" de la app
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// Limpia caches viejos
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Estrategia:
//  - Datos (data/*.json): siempre red primero (para tener lo mas fresco),
//    y si no hay internet, usa lo ultimo cacheado.
//  - Resto (html/css/js/iconos): cache primero (carga instantanea).
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  const esDato = url.pathname.includes("/data/");
  if (esDato) {
    e.respondWith(
      fetch(e.request)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; })
        .catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request))
    );
  }
});

// public/service-worker.js
//
// Deliberately NOT using Workbox precaching — that requires build-time
// manifest injection via the cra-template-pwa webpack config, which this
// project doesn't have wired in (it was bootstrapped from the plain CRA
// template). Rather than eject or add build tooling just for this, this is
// a minimal, hand-written service worker using a network-first strategy:
// always try the network first, and only fall back to a cached copy if the
// network fails (i.e. genuinely offline).
//
// This satisfies Chrome's PWA installability requirement (a registered
// service worker with a fetch handler, needed for the automatic "Add to
// Home Screen" prompt on Android) while deliberately avoiding the
// stale-version risk a cache-first strategy would carry — SendMe handles
// real donations and PayFast payments, so nobody should ever be served old
// JS just because a service worker preferred its cache over the network.

const CACHE_NAME = "sendme-cache-v1";

self.addEventListener("activate", (event) => {
  // Clean up any caches from a previous CACHE_NAME version
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Lets the app force this waiting worker to activate immediately instead of
// waiting for every open tab to close first — paired with UpdateBanner.js's
// "Refresh" button, so an update only ever applies when the person chooses
// to, never silently mid-session.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

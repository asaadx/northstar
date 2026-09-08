/**
 * Northstar service worker: offline shell.
 *
 * Plain JS on purpose. It lives in `public/` so it is served unhashed at a
 * stable root-scope URL, which a bundled module could not guarantee.
 */

const CACHE = "northstar-v5";
const APP_SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png"];

/* -------------------------------------------------------------- lifecycle */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Individually, so one 404 cannot fail the whole install.
      await Promise.all(
        APP_SHELL.map((url) => cache.add(url).catch(() => undefined)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

/* ------------------------------------------------------------------ fetch */

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first so a deploy is picked up, cache as the offline net.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put("./index.html", response.clone());
          return response;
        } catch {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match("./index.html")) ??
            (await cache.match("./")) ??
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // Assets: cache first. Safe because production filenames are content-hashed.
  // This worker is only registered in production builds for exactly that
  // reason; in development Vite serves modules at stable paths and a cached
  // hit would shadow every later edit.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request);
      if (hit !== undefined) return hit;

      const response = await fetch(request);
      if (response.ok && response.type === "basic") cache.put(request, response.clone());
      return response;
    })(),
  );
});

/**
 * Nexus Autonomous Agent - PWA Service Worker
 * File: web_control/src/sw.ts
 * 
 * Enables offline caching, background message sync, and push notifications
 * across desktop and mobile devices on Cloudflare Pages.
 */

const CACHE_NAME = "nexus-pwa-v2.2.0";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico"
];

self.addEventListener("install", (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      return (self as any).skipWaiting();
    })
  );
});

self.addEventListener("activate", (event: any) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return (self as any).clients.claim();
    })
  );
});

self.addEventListener("fetch", (event: any) => {
  const url = new URL(event.request.url);

  // Bypass API routes from cache
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Return offline fallback if network fails
        return caches.match("/");
      });
    })
  );
});

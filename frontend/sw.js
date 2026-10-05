/**
 * Service Worker for Nexus Remote Agent PWA
 * Provides asset caching for offline resilience and Web Push notification handling.
 */

const CACHE_NAME = "nexus-pwa-v2";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json"
];

// 1. Install Event: Cache Core App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[PWA Service Worker] Caching app shell...");
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => console.warn("Caching error:", err));
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Clean Old Caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Event: Network-first for /api, Cache-first for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip caching API requests
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResp) => {
      if (cachedResp) {
        // Return cached and refresh in background
        fetch(event.request).then((networkResp) => {
          if (networkResp && networkResp.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResp));
          }
        }).catch(() => {});
        return cachedResp;
      }
      return fetch(event.request);
    })
  );
});

// 4. Push Notification Event: Displays incoming system notifications
self.addEventListener("push", (event) => {
  let data = { title: "Nexus Agent Alert", body: "New task completed on target device." };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body || data.content,
    icon: "/manifest.json",
    badge: "/manifest.json",
    vibrate: [200, 100, 200],
    data: { url: "/" },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 5. Notification Click Handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});

/* Service worker — shell. Offline para red mala. Scaffold: no cachea todavía.
   TODO(Sx): cache-first del app-shell + última copia de los bundles JSON. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
// TODO(Sx): self.addEventListener("fetch", ...) con estrategia cache-first.

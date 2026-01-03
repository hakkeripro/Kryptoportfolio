/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any[] };

clientsClaim();
self.skipWaiting();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// --- Web Push handling ---
// Payload shape is controlled by the server/runner.
// We keep it tolerant: JSON -> {title, body, data, url}, or plain text.
self.addEventListener('push', (event) => {
  const fallback = {
    title: 'Kryptoportfolio',
    body: 'You have an alert.',
    url: '/alerts',
    data: {}
  };

  event.waitUntil(
    (async () => {
      let msg: any = null;
      try {
        msg = event.data ? event.data.json() : null;
      } catch {
        try {
          const t = event.data ? await event.data.text() : '';
          msg = t ? { ...fallback, body: t } : null;
        } catch {
          msg = null;
        }
      }

      const payload = { ...fallback, ...(msg ?? {}) };
      const title = String(payload.title ?? fallback.title);
      const body = String(payload.body ?? fallback.body);
      const url = String(payload.url ?? fallback.url);

      await self.registration.showNotification(title, {
        body,
        data: { ...(payload.data ?? {}), url },
        // Make sure notifications are displayed on most platforms
        requireInteraction: false
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification as any)?.data?.url || '/alerts';
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of allClients) {
        // If an existing tab is open, focus it and navigate.
        if ('focus' in c) {
          await (c as WindowClient).focus();
          try {
            (c as WindowClient).navigate(url);
          } catch {}
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});

/* global self, clients */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    try {
      data = event.data ? JSON.parse(event.data.text()) : {};
    } catch {
      data = {};
    }
  }

  const title = data.title || "Kryptoportfolio";
  const body = data.body || "Notification";
  const url = data.url || "/alerts";

  const options = {
    body,
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) await clients.openWindow(url);
    })()
  );
});

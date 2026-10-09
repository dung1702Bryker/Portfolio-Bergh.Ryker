// Service Worker Push Event Handler for background notifications
// This runs even when the application tab is CLOSED or the device is LOCKED.

self.addEventListener("push", (event) => {
  let payload = {
    title: "BERGH.RYKER Cảnh Báo",
    body: "Có đơn đặt lịch mới hoặc khách lạ vừa vào website!",
    url: "/",
    tag: "bergh-ryker-alert-" + Date.now(),
  };

  if (event.data) {
    try {
      const json = event.data.json();
      payload = { ...payload, ...json };
    } catch (e) {
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: "/pwa-192x192.png",
    badge: "/apple-touch-icon.png",
    vibrate: [300, 100, 300, 100, 400],
    data: payload.url || "/",
    requireInteraction: true,
    tag: payload.tag || "bergh-ryker-alert",
    renotify: true,
    actions: [
      { action: "open", title: "🔍 Mở xem ngay" }
    ]
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and optionally navigate
      for (const client of clientList) {
        if (client.url && client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client && targetUrl && targetUrl !== "/") {
            client.navigate(targetUrl).catch(() => {});
          }
          return client.focus();
        }
      }
      // Otherwise, open a new window to the target URL
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

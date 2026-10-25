// VTS 알림 테스트용 서비스 워커
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// 서버에서 푸시가 오면 반드시 알림을 띄운다(iOS는 '조용한 푸시'를 허용하지 않음)
self.addEventListener('push', event => {
  let d = {};
  if (event.data) {
    try { d = event.data.json(); } catch (_) { d = { body: event.data.text() }; }
  }
  const title = d.title || 'VTS 근무 알림';
  const opts = {
    body: d.body || '알림이 도착했습니다.',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || ('vts-' + Date.now()),
    data: { url: d.url || './push-test.html', receivedAt: Date.now() }
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './push-test.html';
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { await c.focus(); return; } }
    await clients.openWindow(url);
  })());
});

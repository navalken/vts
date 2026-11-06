// VTS 알림 서비스 워커
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// 카드 화면 주소: 알림에 실린 카드 데이터를 주소 뒤(#c=...)에 담아 card.html로 연다
function cardUrl(card) {
  try { return new URL('card.html#c=' + encodeURIComponent(JSON.stringify(card)), self.registration.scope).href; }
  catch (_) { return new URL('app.html', self.registration.scope).href; }
}

// 서버에서 푸시가 오면 반드시 알림을 띄운다(iOS는 '조용한 푸시'를 허용하지 않음)
self.addEventListener('push', event => {
  let d = {};
  if (event.data) {
    try { d = event.data.json(); } catch (_) { d = { body: event.data.text() }; }
  }
  const title = d.title || 'VTS 근무 알림';
  const card = d.card && typeof d.card === 'object' ? d.card : null;
  const opts = {
    body: (d.body != null ? d.body : '알림이 도착했습니다.'),
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || ('vts-' + Date.now()),
    data: { url: card ? cardUrl(card) : (d.url || new URL('app.html', self.registration.scope).href), receivedAt: Date.now() }
  };
  // 갤럭시(크롬)는 알림을 펼치면 큰 그림이 보임. 아이폰은 이 옵션을 무시하고 눌러야 카드가 열림
  if (card) {
    const kind = card.k === 'q' ? 'wait' : card.k === 'r' ? 'rest' : 'work';
    try { opts.image = new URL('img/n-' + kind + '.jpg', self.registration.scope).href; } catch (_) { /* 그림 없이 */ }
  }
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || new URL('app.html', self.registration.scope).href;
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) {
        try { await c.focus(); if ('navigate' in c) { await c.navigate(url); return; } } catch (_) { /* 아래에서 새 창으로 */ }
      }
    }
    await clients.openWindow(url);
  })());
});

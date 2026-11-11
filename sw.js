// VTS 알림 서비스 워커
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// 카드 화면·그림을 바꿨을 때 이 숫자를 올리면 폰에 남은 예전 화면 대신 새 화면이 열린다
const CARD_VER = '7';

// 카드 화면 주소: 알림에 실린 카드 데이터를 주소 뒤(#c=...)에 담아 card.html로 연다
function cardUrl(card) {
  try { return new URL('card.html?v=' + CARD_VER + '#c=' + encodeURIComponent(JSON.stringify(card)), self.registration.scope).href; }
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
  // 알림 종류: 대기 q / 휴게 r / 그 외 근무. 상태 표시줄 작은 아이콘(흰색 실루엣)을 종류별로 고름
  const kind = card ? (card.k === 'q' ? 'wait' : card.k === 'r' ? 'rest' : 'work') : 'work';
  const opts = {
    body: (d.body != null ? d.body : '알림이 도착했습니다.'),
    // icon 생략: 접힌 알림 오른쪽 큰 그림을 빼서 글자 자리를 넓힘
    badge: 'img/b-' + kind + '.png',
    tag: d.tag || ('vts-' + Date.now()),
    data: { url: card ? cardUrl(card) : (d.url || new URL('app.html', self.registration.scope).href), receivedAt: Date.now() }
  };
  // 갤럭시(크롬)는 알림을 펼치면 큰 그림이 보임. 아이폰은 이 옵션을 무시하고 눌러야 카드가 열림
  if (card) {
    try { opts.image = new URL('img/n-' + kind + '-' + (card.sh === 'night' ? 'night' : 'day') + '.jpg', self.registration.scope).href; } catch (_) { /* 그림 없이 */ }
  }
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || new URL('app.html', self.registration.scope).href;
  event.waitUntil((async () => {
    // 아이폰은 꺼져 있던 홈 화면 앱을 알림으로 열면 지정한 주소 대신 시작 화면을 열기도 한다.
    // 그래서 "누른 알림의 주소"를 적어 두고, 앱이 열리면 스스로 그 주소로 이동한다(2분 안에만 유효).
    try { if (typeof caches !== 'undefined') { const cc = await caches.open('vts-click'); await cc.put(new URL('__click', self.registration.scope).href, new Response(JSON.stringify({ url, t: Date.now() }))); } } catch (_) { /* 없어도 아래 방식으로 동작 */ }
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (!('focus' in c)) continue;
      try { await c.focus(); } catch (_) { /* 계속 */ }
      // 아이폰 홈 화면 앱은 navigate()가 조용히 실패하는 경우가 있어, 앱 화면에도 직접 "이 주소로 가라"고 알려 준다
      // 아이폰은 백그라운드에 있던 앱이 깨어나는 데 시간이 걸려, 첫 메시지를 놓칠 수 있다 → 몇 번 더 알린다
      const tell = () => { try { c.postMessage({ type: 'vts-open', url }); } catch (_) { /* 계속 */ } };
      tell(); await new Promise(r => setTimeout(r, 400)); tell(); await new Promise(r => setTimeout(r, 1200)); tell();
      try { if ('navigate' in c) { await c.navigate(url); return; } } catch (_) { continue; /* 이 창은 이동 불가 → 아래에서 새 창으로 */ }
      return;
    }
    await clients.openWindow(url);
  })());
});

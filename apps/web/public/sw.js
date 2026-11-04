// JobLog PWA 서비스워커 — 설치 가능 조건(SW 등록 + fetch 핸들러 존재)만 충족한다.
// 오프라인 캐시는 아직 하지 않는다(항상 네트워크). 설치 유도만 활성화하는 최소 구현.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
// respondWith를 호출하지 않으면 브라우저 기본 네트워크 동작 — 캐시로 인한 stale 없음.
self.addEventListener('fetch', () => {});

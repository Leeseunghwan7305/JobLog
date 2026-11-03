// JobLog 공고 담기 — 현재 탭의 공고 URL을 캡처해 JobLog 웹을 ?addUrl= 로 연다.
// 인증/비밀값은 익스텐션에 두지 않는다. 저장은 로그인된 JobLog 웹 세션이 처리.

// 로컬 개발 시 'http://localhost:3000' 으로 바꿔 쓸 수 있다.
const WEB_ORIGIN = 'https://joblog-web.vercel.app';

const btn = document.getElementById('add');
const siteEl = document.getElementById('site');
let current = null;

chrome.tabs
  .query({ active: true, currentWindow: true })
  .then((tabs) => {
    current = tabs[0] ?? null;
    const url = current?.url ?? '';
    if (!/^https?:\/\//.test(url)) {
      siteEl.textContent = '이 페이지는 담을 수 없어요';
      btn.disabled = true;
      return;
    }
    try {
      siteEl.textContent = new URL(url).hostname;
    } catch {
      siteEl.textContent = url;
    }
  })
  .catch(() => {
    siteEl.textContent = '현재 탭을 읽지 못했어요';
    btn.disabled = true;
  });

btn.addEventListener('click', () => {
  const url = current?.url;
  if (!url) return;
  const target = `${WEB_ORIGIN}/?addUrl=${encodeURIComponent(url)}`;
  void chrome.tabs.create({ url: target });
  window.close();
});

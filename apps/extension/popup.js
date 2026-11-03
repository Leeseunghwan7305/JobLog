// JobLog 공고 담기 — 현재 탭의 공고 URL + 본문 텍스트를 캡처해
// chrome.storage에 담고 JobLog 웹을 연다. content script가 그걸 page
// localStorage로 넘겨, 로그인된 웹 세션이 본문으로 분석·저장한다.
// 인증/비밀값은 익스텐션에 저장하지 않는다.

// 로컬 개발 시 'http://localhost:3000' 으로 바꿔 쓸 수 있다.
// (바꾸면 manifest의 host_permissions·content_scripts matches도 함께 수정.)
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

btn.addEventListener('click', async () => {
  if (!current?.id || !current.url) return;
  btn.disabled = true;
  btn.textContent = '담는 중…';
  try {
    // 현재 탭에서 공고 본문 텍스트를 읽는다(activeTab + scripting).
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: current.id },
      func: () => ({
        url: location.href,
        title: document.title,
        text: (document.body?.innerText ?? '').slice(0, 20000),
      }),
    });
    const capture = result ?? {
      url: current.url,
      title: current.title ?? '',
      text: '',
    };
    await chrome.storage.local.set({ joblog_ext_capture: capture });
    await chrome.tabs.create({ url: WEB_ORIGIN });
    window.close();
  } catch {
    // 본문을 못 읽어도 URL만이라도 넘긴다(웹이 링크로 재분석).
    await chrome.storage.local.set({
      joblog_ext_capture: { url: current.url, title: current.title ?? '', text: '' },
    });
    await chrome.tabs.create({ url: WEB_ORIGIN });
    window.close();
  }
});

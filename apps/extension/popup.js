// JobLog 공고 담기 — 팝업 안에서 현재 공고를 바로 분석(공개 preview API)해 결과를
// 보여주고, '저장'은 JobLog 웹의 로그인 세션으로 넘긴다(인증/비밀값은 익스텐션에 저장 안 함).
// 분석은 URL로(서버가 스크랩+사이트 어댑터), 저장 시엔 캡처 본문도 함께 넘겨 폴백.

const API_BASE = 'https://api.joblog.store';
const WEB_ORIGIN = 'https://joblog-web.vercel.app';
const bodyEl = document.getElementById('body');

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const render = (html) => {
  bodyEl.innerHTML = html;
};

// 저장 플로우용 공고 캡처(URL + 본문)
let capture = null;

async function run() {
  render('<div class="muted"><span class="spinner"></span>공고를 분석하고 있어요…</div>');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';
  if (!/^https?:\/\//.test(url)) {
    render('<div class="muted">이 페이지는 분석할 수 없어요.<br>채용 공고 페이지에서 눌러 주세요.</div>');
    return;
  }

  // 현재 탭 본문 캡처(activeTab + scripting) — 저장 시 폴백용
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        url: location.href,
        title: document.title,
        text: (document.body?.innerText ?? '').slice(0, 20000),
      }),
    });
    capture = result ?? { url, title: tab.title ?? '', text: '' };
  } catch {
    capture = { url, title: tab.title ?? '', text: '' };
  }

  // 공개 분석(로그인 불필요)
  let res;
  try {
    const r = await fetch(`${API_BASE}/parse/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: capture.url }),
    });
    if (!r.ok) throw new Error('http ' + r.status);
    res = await r.json();
  } catch {
    render(
      '<div class="err">분석에 실패했어요. 잠시 후 다시 시도해 주세요.</div>' +
        '<button class="btn" id="retry">다시 시도</button>' +
        '<button class="btn ghost" id="openweb">JobLog에서 직접 담기</button>',
    );
    on('retry', run);
    on('openweb', saveToJobLog);
    return;
  }

  if (res.needsManualInput) {
    render(
      `<div class="notice">${esc(res.notice || '자동 분석이 어려운 공고예요. JobLog에서 본문을 붙여넣어 담아 주세요.')}</div>` +
        '<button class="btn" id="openweb">JobLog에서 담기</button>',
    );
    on('openweb', saveToJobLog);
    return;
  }

  const d = res.draft ?? {};
  const stages = (d.stages ?? [])
    .map(
      (s, i) =>
        (i ? '<span class="arrow">→</span>' : '') + `<span class="stage">${esc(s.name)}</span>`,
    )
    .join('');
  const meta = [
    d.location && `📍 ${esc(d.location)}`,
    d.employmentType && `💼 ${esc(d.employmentType)}`,
    d.deadline && `🗓 ~${esc(d.deadline)}`,
  ]
    .filter(Boolean)
    .map((x) => `<span>${x}</span>`)
    .join('');

  render(
    `<div class="company">${esc(d.companyName || '회사명 미정')}</div>` +
      `<div class="position">${esc(d.position || '직무 미정')}</div>` +
      (meta ? `<div class="meta">${meta}</div>` : '') +
      (stages ? `<div class="stages">${stages}</div>` : '') +
      (res.notice ? `<div class="notice">${esc(res.notice)}</div>` : '') +
      '<button class="btn kakao" id="save">JobLog에 저장하기</button>' +
      '<button class="btn ghost" id="again">다시 분석</button>' +
      '<p class="muted" style="text-align:center;margin-top:8px;font-size:11px">저장하려면 JobLog 로그인이 필요해요</p>',
  );
  on('save', saveToJobLog);
  on('again', run);
}

// 캡처를 JobLog 웹으로 넘겨 로그인 세션이 저장하게 한다.
async function saveToJobLog() {
  if (capture) await chrome.storage.local.set({ joblog_ext_capture: capture });
  await chrome.tabs.create({ url: WEB_ORIGIN });
  window.close();
}

function on(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

run();

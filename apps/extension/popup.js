'use strict';

const API = 'https://joblog.duckdns.org';
const WEB = 'https://joblog-web.vercel.app';

const root = document.getElementById('root');

/* ───────── 유틸 ───────── */

function esc(s) {
  return String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
}

async function activeTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab && tab.url ? tab.url : '';
}

async function getToken() {
  const { joblog_token } = await chrome.storage.local.get('joblog_token');
  return joblog_token || null;
}

function openWeb(path = '/') {
  chrome.tabs.create({ url: WEB + path });
}

/* ───────── 화면 ───────── */

function renderInfo(msg) {
  root.innerHTML = `<p class="muted">${esc(msg)}</p>`;
}

function renderLoading() {
  root.innerHTML = `<p class="muted"><span class="spinner"></span>AI가 공고를 읽는 중…</p>`;
}

function renderError(msg, url) {
  root.innerHTML = `
    <p class="err">${esc(msg)}</p>
    <button class="btn ghost" id="retry">다시 시도</button>
    <button class="btn ghost" id="openWeb">JobLog 웹에서 열기</button>`;
  document.getElementById('retry').onclick = () => run();
  document.getElementById('openWeb').onclick = () => openWeb('/');
}

function stagesHtml(stages) {
  if (!stages || stages.length === 0) return '';
  const chips = stages
    .map(
      (s, i) =>
        `${i > 0 ? '<span class="arrow">→</span>' : ''}<span class="stage">${esc(s.name)}</span>`,
    )
    .join('');
  return `<div class="stages">${chips}</div>`;
}

function renderManual(notice, url) {
  root.innerHTML = `
    <div class="notice">${esc(notice || '이 공고는 자동 분석이 어려워요. JobLog에서 직접 입력해 주세요.')}</div>
    <button class="btn" id="openWeb">JobLog에서 직접 입력</button>`;
  document.getElementById('openWeb').onclick = () => openWeb('/');
}

async function renderPreview(draft, url) {
  const meta = [
    draft.location && `📍 ${esc(draft.location)}`,
    draft.employmentType && `💼 ${esc(draft.employmentType)}`,
    draft.deadline && `🗓 ~${esc(draft.deadline)}`,
  ]
    .filter(Boolean)
    .join('');
  const token = await getToken();

  root.innerHTML = `
    <div class="company">${esc(draft.companyName || '회사명 미정')}</div>
    <div class="position">${esc(draft.position || '직무 미정')}</div>
    ${meta ? `<div class="meta">${meta}</div>` : ''}
    ${stagesHtml(draft.stages)}
    ${
      token
        ? `<button class="btn" id="save">JobLog에 저장</button>`
        : `<button class="btn kakao" id="login">로그인하고 저장</button>
           <p class="muted" style="margin-top:8px;text-align:center">로그인하면 이 버튼이 바로 ‘저장’이 돼요</p>`
    }`;

  if (token) {
    document.getElementById('save').onclick = () => save(draft, url, token);
  } else {
    document.getElementById('login').onclick = () => openWeb('/');
  }
}

function renderSaved() {
  root.innerHTML = `
    <div class="ok">
      <div class="check">✓</div>
      <div class="t">JobLog에 저장했어요</div>
      <p class="muted" style="margin-top:4px">대시보드에서 전형을 추적하세요</p>
    </div>
    <button class="btn" id="dash">대시보드 열기</button>`;
  document.getElementById('dash').onclick = () => openWeb('/');
}

/* ───────── 동작 ───────── */

async function save(draft, url, token) {
  const btn = document.getElementById('save');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '저장 중…';
  }
  const stages = (draft.stages || [])
    .map((s) => (s.name || '').trim())
    .filter((n) => n.length > 0)
    .map((name, i) => ({ name, order: i }));
  try {
    const res = await fetch(`${API}/applications`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        companyName: (draft.companyName || '').trim(),
        position: (draft.position || '').trim(),
        jobUrl: url || undefined,
        location: draft.location || undefined,
        employmentType: draft.employmentType || undefined,
        deadline: draft.deadline || undefined,
        stages,
      }),
    });
    if (res.status === 401) {
      // 토큰 만료 → 재로그인 유도
      await chrome.storage.local.remove('joblog_token');
      renderPreview(draft, url);
      return;
    }
    if (!res.ok) throw new Error(`저장 실패 (${res.status})`);
    renderSaved();
  } catch (e) {
    renderError('저장에 실패했어요. 잠시 후 다시 시도해 주세요.', url);
  }
}

async function run() {
  renderLoading();
  const url = await activeTabUrl();
  if (!/^https?:\/\//.test(url)) {
    renderInfo('채용 공고 페이지에서 확장 아이콘을 눌러주세요.');
    return;
  }
  try {
    const res = await fetch(`${API}/parse/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (res.status === 429) {
      renderError(
        '체험 분석 횟수를 초과했어요. 로그인하면 제한 없이 이용할 수 있어요.',
        url,
      );
      return;
    }
    if (!res.ok) throw new Error(`분석 실패 (${res.status})`);
    const data = await res.json();
    if (data.needsManualInput) {
      renderManual(data.notice, url);
      return;
    }
    await renderPreview(data.draft, url);
  } catch (e) {
    renderError('공고를 분석하지 못했어요.', url);
  }
}

run();

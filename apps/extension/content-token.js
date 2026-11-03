// JobLog 웹(joblog-web)에 로그인돼 있으면 토큰을 확장 저장소로 동기화한다.
// → 팝업에서 별도 로그인 없이 바로 공고를 저장할 수 있다. (로그아웃 시 토큰 제거)
try {
  const token = window.localStorage.getItem('joblog_token');
  if (token) {
    chrome.storage.local.set({ joblog_token: token });
  } else {
    chrome.storage.local.remove('joblog_token');
  }
} catch (e) {
  // 접근 불가 시 조용히 무시 (확장 동작엔 영향 없음)
}

// joblog-web에서 document_start에 실행. 익스텐션이 chrome.storage에 담아둔
// 공고 캡처(URL+본문)를 page localStorage로 넘긴다. 페이지 React가 마운트해
// 읽기 전에 심어 레이스를 피한다.
chrome.storage.local.get('joblog_ext_capture').then((o) => {
  const cap = o && o.joblog_ext_capture;
  if (!cap) return;
  void chrome.storage.local.remove('joblog_ext_capture');
  try {
    window.localStorage.setItem('joblog_ext_capture', JSON.stringify(cap));
  } catch {
    /* 저장 불가 환경이면 조용히 무시 */
  }
});

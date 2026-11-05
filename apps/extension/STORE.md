# Chrome 웹 스토어 제출 가이드

익스텐션을 누구나 "Chrome에 추가"로 설치하려면 Chrome 웹 스토어 등록이 필요하다.
아래는 제출에 필요한 자료(제가 준비)와 본인이 해야 할 단계다.

## 본인이 해야 할 것

1. **개발자 등록** — https://chrome.google.com/webstore/devconsole 에서 구글 계정으로
   등록(일회성 등록비 **$5**).
2. **패키지 업로드** — `pnpm --filter ... ` 대신 아래 zip을 만들어 업로드:
   ```bash
   bash apps/extension/scripts/package.sh
   # → apps/extension/dist/joblog-extension-0.2.0.zip
   ```
3. **리스팅 작성**(아래 복붙) + **스크린샷** 업로드 + **개인정보 URL** 입력 → 제출.
4. 구글 심사(보통 수일) 통과 후 게시.

## 스토어 리스팅 (복붙용)

- **이름**: JobLog — 공고 담기
- **요약(한 줄)**: 보고 있는 채용 공고를 클릭 한 번으로 JobLog에 담기
- **카테고리**: 생산성(Productivity)
- **언어**: 한국어
- **상세 설명**:
  ```
  채용 공고를 보다가 JobLog 아이콘만 누르면, 복사·붙여넣기 없이 그 공고가
  바로 JobLog에 담깁니다. 원티드·잡코리아·사람인 등 어디서든.

  • 클릭 한 번 — 현재 공고 URL을 캡처해 JobLog에서 분석·저장
  • 로그인된 JobLog 세션이 처리 — 익스텐션에는 비밀번호·토큰을 저장하지 않음
  • 최소 권한(activeTab) — 담기를 누른 순간의 현재 탭 주소만 사용

  JobLog는 지원한 공고의 전형(서류·면접·최종)을 한곳에서 추적하는 서비스입니다.
  ```
- **개인정보 처리방침 URL**: `https://joblog-web.vercel.app/privacy`

## 권한 사유 (심사용)

- **activeTab** + **scripting**: 사용자가 담기 버튼을 누른 순간에만 현재 탭의
  URL과 공고 본문 텍스트를 읽어 JobLog로 전달하기 위함. 백그라운드 추적·상시 접근 없음.
- **storage**: 캡처한 공고를 JobLog 탭으로 넘기기 위해 잠시 보관(넘긴 뒤 삭제).
- **host_permissions: `https://joblog-web.vercel.app/*`**: 캡처한 공고를 JobLog
  웹에만 주입(다른 사이트 접근 없음). content script도 이 도메인에서만 실행.
- **단일 목적(single purpose)**: 현재 보고 있는 채용 공고를 JobLog에 담는다.
- 원격 코드 없음, `<all_urls>` 같은 광범위 호스트 권한 없음.

## 필요한 에셋

- **아이콘** — `icons/icon{16,48,128}.png` (준비됨).
- **스크린샷** — 1280×800(또는 640×400) 1장 이상. 익스텐션 팝업 + 담긴 결과 화면 권장.
  (실제 동작 화면 캡처는 본인 환경에서.)
- (선택) 프로모 타일 440×280.

# JobLog 브라우저 확장 (Chrome MV3)

채용 공고 페이지에서 **클릭 한 번으로 JobLog에 저장**. AI가 회사·직무·전형을 자동 정리합니다.

## 동작

1. 원티드·잡코리아·사람인 등 **공고 페이지에서 확장 아이콘 클릭**
2. 팝업이 현재 탭 URL을 공개 `/parse/preview`로 분석 → **회사·직무·전형 미리보기** (로그인 불필요)
3. **JobLog 웹에 로그인돼 있으면** → `JobLog에 저장` 버튼으로 **바로 저장**
   - 로그인 토큰은 `joblog-web.vercel.app` 방문 시 content script가 확장 저장소로 동기화한다.
4. 로그인 전이면 → `로그인하고 저장` → 웹에서 카카오 로그인 후, 다시 공고에서 아이콘을 누르면 저장됨.

확장 페이지(popup)의 fetch는 `host_permissions`로 허용돼 **API의 CORS 설정과 무관**하게 호출된다(백엔드 수정 불필요).

## 설치 (개발/테스트)

1. Chrome → `chrome://extensions`
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드** → 이 `apps/extension` 폴더 선택
4. (처음 1회) `joblog-web.vercel.app` 에서 카카오 로그인 → 토큰 동기화

## 구조

- `manifest.json` — MV3 설정(action popup, host_permissions, content script)
- `popup.html` / `popup.css` / `popup.js` — 분석·저장 UI
- `content-token.js` — joblog-web 로그인 토큰을 확장으로 동기화
- `icons/` — 툴바 아이콘 (브랜드 인디고; 더 멋진 아이콘으로 교체 가능)

## 커스터마이즈

- API/웹 주소는 `popup.js` 상단의 `API`, `WEB` 상수에서 변경.
- 로컬 개발 서버로 붙이려면 `API`를 `http://localhost:4000`, `WEB`을 로컬 포트로 바꾸고
  `manifest.json`의 `host_permissions`·content script `matches`에 해당 주소를 추가한다.

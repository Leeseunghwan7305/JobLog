# JobLog 크롬 익스텐션 (v0.1)

보고 있는 채용 공고를 **클릭 한 번으로 JobLog에 담는** Chrome 확장 프로그램.

## 동작

1. 공고 페이지(원티드·잡코리아·사람인 등)에서 툴바의 JobLog 아이콘 클릭.
2. 팝업의 **＋ 이 공고 담기** 버튼 → 현재 탭 URL을 캡처.
3. JobLog 웹을 `?addUrl=<공고 URL>` 로 새 탭에서 열고, 로그인된 세션이
   기존 분석·저장 흐름을 그대로 수행(복붙 불필요).

> 인증(JWT)·비밀값을 익스텐션에 저장하지 않는다. 저장은 **JobLog 웹의 로그인 세션**이 담당하므로, 익스텐션은 URL만 넘긴다.

## 로컬에서 로드 (unpacked)

1. Chrome → `chrome://extensions`
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드** → 이 `apps/extension` 폴더 선택
4. 공고 페이지에서 아이콘 클릭해 테스트

로컬 웹(`localhost:3000`)으로 테스트하려면 `popup.js`의 `WEB_ORIGIN`을 바꾼다.

## 구성 (MV3, 빌드 불필요)

- `manifest.json` — Manifest V3, `activeTab` 권한만(클릭 시 현재 탭 URL 접근).
- `popup.html` / `popup.js` — 담기 버튼 + 현재 탭 URL 캡처 → 웹 열기.
- `icons/` — 16/48/128 PNG (소스: `scripts/make-icons.mjs`, 순수 Node 생성).
- `scripts/package.sh` — 스토어 업로드용 zip 생성(`dist/`).
- `STORE.md` — 스토어 리스팅 복붙·권한 사유·제출 단계.

## 스토어 배포

누구나 "Chrome에 추가"로 설치하려면 **Chrome 웹 스토어 등록**이 필요하다
(일회성 $5 + 구글 심사). 자료·절차는 [`STORE.md`](STORE.md). 개인정보 처리방침은
`https://joblog-web.vercel.app/privacy`.

```bash
bash apps/extension/scripts/package.sh   # → dist/joblog-extension-0.1.0.zip 업로드
```

## 로드맵

- [x] 아이콘(16/48/128), 스토어 제출 자료, 개인정보 처리방침.
- [ ] **페이지 본문 텍스트 캡처** — `scripting`으로 `document.body.innerText`를 함께
      넘겨 Firecrawl 스크랩이 막히는 사이트도 담기(웹의 붙여넣기 폴백 재사용).
- [ ] 담기 성공 토스트/뱃지 피드백.
- [ ] 스토어 게시 후 랜딩의 "크롬에 추가(준비 중)" 버튼을 스토어 링크로 교체.

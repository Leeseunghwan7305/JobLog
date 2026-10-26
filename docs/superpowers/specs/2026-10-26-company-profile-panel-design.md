# 회사 정보 확장 패널 (국민연금 공개데이터) — 설계

> 2026-10-26 · 상위 문서: `spec.md` §6 (기업 후기), §6.1 (회사명 정규화·매칭)
> 상태: 승인됨 (브레인스토밍 → 설계 승인). 다음 단계: writing-plans.

## 1. 배경 / 목표

지원 상세에서 **회사명을 눌렀을 때** 그 회사에 대해 "볼 수 있는 건 다" 보여준다. 기준 레퍼런스는 jotso.net(좋소력) 회사 페이지 — 그 숫자들은 전부 **국민연금 가입사업장 공개데이터 기반 추정**이다. 우리는 그 공개데이터에서 바로 나오는 원지표를 인앱으로 수집해 보여주고, 기존 잡플래닛 평점과 외부 바로가기를 한 패널에 모은다.

**목표**

- 지원 상세 내 확장 패널에서 회사 핵심 지표(직원수·추정연봉·입퇴사·업종·지역)를 인앱 표시.
- 기존 잡플래닛 평점·요약을 같은 패널에 통합.
- 공개 소스(잡플래닛·잡서치·크레딧잡·공고검색) 바로가기 묶음 제공.

**비목표 (YAGNI)**

- jotso의 합성지표(좋소력 점수·소멸위험도) — 그쪽 자체 산식이라 제외.
- 전용 `/companies/[key]` 페이지, 북마크/즐겨찾기.
- 전체 후기 본문 수집·저장 (spec §6 원칙 유지).

## 2. 설계 원칙 (기존 spec 계승)

- **자신 있게 틀리지 않기**: 회사명→사업장 매칭이 모호(0건·복수)하면 지표를 숨기고 바로가기만. (spec §6.1)
- **우아한 폴백**: 외부 키/네트워크 없이도 앱이 죽지 않는다. 각 블록은 독립적으로 비면 숨는다.
- **출처 명시**: 인앱 숫자에 "국민연금 공개데이터 기반 추정" 면책 문구.
- **순수/부수 분리**: 외부 호출(I/O)과 계산·파싱(순수)을 나눠 순수부는 단위테스트.

## 3. 데이터 출처: 국민연금 가입 사업장 내역 (공공데이터포털 V2)

- 검색: `GET http://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2/getBassInfoSearchV2`
  - 입력: `wkpl_nm`(사업장명), `serviceKey`, `pageNo`, `numOfRows`, `resultType=json`
  - 출력(건별): `seq`, `wkplNm`(사업장명), `bzowrRgstNo`(사업자번호 앞 6자리+마스킹), `wkplRoadNmDtlAddr`(주소), `wkplIntpCd`(업종코드), `dataCrtYm`(자료생성연월) 등
- 상세: `GET …/getDetailInfoSearchV2`
  - 입력: `seq`, `serviceKey`, `resultType=json`
  - 출력: `jnngpCnt`(가입자수), `crrmmNtcAmt`(당월고지금액), `nwAcqzrCnt`(신규취득자수), `lssJdgmntCnt`(상실가입자수), 업종명 등
- **추정 평균연봉(만원)** = `round( (crrmmNtcAmt / jnngpCnt) / 0.09 * 12 / 10000 )`
  - 국민연금 보험료율 9% 가정. 소득상한 때문에 실제와 차이날 수 있음 → "추정" 표기 필수.
- 키: `NPS_API_KEY` (공공데이터포털 인증키). 없으면 `enabled=false`.
- 주의: V1(`…Service/…Search`)은 대체(폐지) 공지 → **V2 엔드포인트 사용**.

## 4. 엔티티 해소 규칙

1. 회사명 정규화(기존 `CompaniesService.normalize`: 법인 접미사·공백 제거) 후 `wkpl_nm`로 검색.
2. 후보 중 **정규화 키가 완전 일치하는 사업장이 정확히 1건**이면 그 `seq`로 상세 조회 → 지표 산출.
3. 0건 또는 복수(동명·지점 등)면 지표 `null`, 바로가기만. (보수적 매칭 — spec §6.1)
4. (후순위 개선 여지) 사용자가 후보 중 직접 고르게 하는 UX는 이번 범위 밖.

## 5. API 계약

신규 엔드포인트. 기존 `GET /companies/reviews`는 유지(하위호환).

```
GET /companies/profile?name=<회사명>      (JWT 가드 — spec §3.2상 /companies/reviews만 공개, profile은 기본 보호)
```

```ts
// @joblog/types
interface CompanyProfileDto {
  companyName: string; // 정규화된 표시명
  nps: {
    memberCount: number;
    estimatedAnnualSalaryManwon: number | null;
    newThisMonth: number | null;
    lostThisMonth: number | null;
    industry: string | null;
    region: string | null;
    dataYm: string | null; // 자료생성연월 (YYYYMM)
  } | null; // 매칭 모호/키없음/실패 시 null
  review: {
    rating: number | null;
    summary: string | null;
    sourceUrl: string;
  } | null;
  links: { label: string; url: string }[]; // 잡플래닛/잡서치/크레딧잡/공고검색
}
```

> `memberTrend`(월별 추이)는 V2가 단월 중심이라 1차 범위에서 제외(원하면 후속). 1차는 단월 스냅샷.

## 6. 데이터 모델 / 캐시

신규 Prisma 모델(후기와 출처·수명주기 분리):

```prisma
model CompanyProfile {
  companyName String   @id          // 정규화 키
  nps         Json?                 // 산출된 지표 스냅샷
  fetchedAt   DateTime @default(now())
}
```

- 캐시 TTL 7일 — 기존 `isCacheFresh` 재사용.
- 잡플래닛 블록은 기존 `CompanyReview` 경로/캐시 그대로 재사용.
- → 마이그레이션 1건 추가.

## 7. 프론트엔드

- `apps/web/src/app/applications/[id]/page.tsx`: 회사명을 버튼으로 → 클릭 시 아코디언 패널 토글.
- 패널: `GET /companies/profile?name=` React Query. 3블록(국민연금/잡플래닛/바로가기) 각각 데이터 있을 때만 렌더.
- 로딩 스켈레톤, 빈 상태(바로가기만), 출처·면책 문구 포함.

## 8. 에러 / 폴백 매트릭스

| 상황                  | 동작                              |
| --------------------- | --------------------------------- |
| `NPS_API_KEY` 없음    | `nps: null` (바로가기만), 앱 정상 |
| 검색 0건/복수         | `nps: null`, 바로가기             |
| NPS API 오류/타임아웃 | `nps: null`, 경고 로그, 바로가기  |
| 잡플래닛 수집 실패    | `review`는 기존 로직대로 딥링크   |
| 전부 실패             | `links`만 있는 패널 (여전히 유용) |

## 9. 테스트

- 순수 함수 단위테스트(`nps.test.ts`, node:test):
  - 연봉 추정 계산(정상/가입자수 0/고지금액 결측 → null).
  - 후보 해소(정규화키 1건 일치 / 0건 / 복수 → null).
  - V2 응답 JSON 파서(필드 매핑, 결측 안전).
- 실호출 품질 확인은 `NPS_API_KEY` 연결 후 수동.

## 10. 리스크 / 오픈 이슈

- 사업장명 검색의 동명·지점 다수 → 보수적 매칭이라 "지표 없음"이 꽤 나올 수 있음(의도된 안전). 추후 후보 선택 UX로 보완 가능.
- 사업자번호 마스킹 → bizno로의 정밀 매칭 불가, 이름 기반이 한계.
- 추정연봉은 소득상한·단월 변동으로 오차 → 반드시 "추정" 표기.
- 공공데이터포털 트래픽 제한(일일 호출수) → 7일 캐시로 완화.

# 회사 정보 확장 패널 (국민연금 공개데이터) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지원 상세에서 회사명을 누르면 확장 패널에서 국민연금 공개데이터 기반 핵심 지표(직원수·추정연봉·입퇴사·업종·지역) + 잡플래닛 평점 + 공개 소스 바로가기를 보여준다.

**Architecture:** 공공데이터포털 "국민연금 가입 사업장 내역 V2" API를 호출하는 `NpsService`(I/O)와, 계산·선택·파싱을 담는 `nps.ts`(순수)를 분리한다. `CompaniesService.getProfile()`이 NPS 지표 + 기존 잡플래닛 후기 로직 + 바로가기 링크를 합쳐 `CompanyProfileDto`로 반환하고 `CompanyProfile`(신규 모델)에 7일 캐시한다. 프론트는 `/applications/[id]`에서 회사명을 버튼화해 아코디언 패널을 토글한다.

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL, `@joblog/types`(워크스페이스 공유 타입), Next.js(App Router) + TanStack Query, node:test(순수 함수 단위테스트, `node --import tsx --test`).

**Spec:** `docs/superpowers/specs/2026-10-26-company-profile-panel-design.md`

## Global Constraints

- **매칭 보수성 (spec §6.1):** 정규화 키가 완전 일치하는 사업장이 **정확히 1건**일 때만 지표를 보여준다. 0건·복수면 `nps: null`.
- **우아한 폴백:** `NPS_API_KEY` 없음/네트워크 실패/모호 매칭 → 해당 블록만 비우고 앱은 정상. 예외를 조용히 삼키지 말고 `logger.warn`.
- **출처 표기:** 인앱 숫자에는 "국민연금 공개데이터 기반 추정" 문구 필수.
- **순수/부수 분리:** 네트워크·DI 없는 계산/선택/파싱은 `nps.ts`에, 테스트는 `nps.test.ts`에.
- **공유 타입 단일 출처:** DTO는 `packages/types/src/index.ts`에 정의하고 api·web이 import.
- **NPS V2 엔드포인트 사용** (V1은 폐지 공지됨).
- **병렬 편집 주의:** 이 레포는 현재 다른 작업과 동시 편집 중이다. 실행 시 **feature 브랜치**에서 작업하고, 각 Task의 커밋 스텝은 **사용자가 커밋을 승인한 뒤** 수행한다(그 전까지는 디스크 변경만, 커밋 보류).
- 각 Task 종료 시 `pnpm --filter @joblog/api typecheck`가 통과해야 한다(Stop 훅도 강제).

---

### Task 1: 공유 타입 `CompanyProfileDto`

**Files:**

- Modify: `packages/types/src/index.ts` (CompanyReviewDto 블록 아래, 64행 근처)

**Interfaces:**

- Produces: `CompanyProfileDto`, `NpsMetrics` — api·web 양쪽이 import.

- [ ] **Step 1: 타입 추가**

`CompanyReviewDto` 인터페이스 바로 아래에 삽입:

```ts
export interface NpsMetrics {
  memberCount: number;
  estimatedAnnualSalaryManwon: number | null;
  newThisMonth: number | null;
  lostThisMonth: number | null;
  industry: string | null;
  region: string | null;
  dataYm: string | null; // 자료생성연월 (YYYYMM)
}

export interface CompanyProfileLink {
  label: string;
  url: string;
}

export interface CompanyProfileDto {
  companyName: string; // 정규화된 표시명
  nps: NpsMetrics | null; // 매칭 모호/키없음/실패 시 null
  review: {
    rating: number | null;
    summary: string | null;
    sourceUrl: string;
  } | null;
  links: CompanyProfileLink[];
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm --filter @joblog/types build && pnpm --filter @joblog/api typecheck`
Expected: PASS (타입만 추가했으므로 에러 없음)

- [ ] **Step 3: Commit** (커밋 승인 후)

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): CompanyProfileDto 추가"
```

---

### Task 2: NPS 순수 헬퍼 + 단위테스트

**Files:**

- Create: `apps/api/src/companies/nps.ts`
- Test: `apps/api/src/companies/nps.test.ts`

**Interfaces:**

- Consumes: 없음(순수).
- Produces:
  - `estimateAnnualSalaryManwon(crrmmNtcAmt: number | null, jnngpCnt: number | null): number | null`
  - `interface NpsWorkplace { seq: string; name: string; bizno: string | null; address: string | null; industry: string | null; dataYm: string | null }`
  - `parseBassItems(json: unknown): NpsWorkplace[]`
  - `pickWorkplace(items: NpsWorkplace[], query: string, normalize: (s: string) => string): NpsWorkplace | null`
  - `parseDetail(json: unknown): { memberCount: number; crrmmNtcAmt: number | null; newThisMonth: number | null; lostThisMonth: number | null; industry: string | null } | null`
  - `buildLinks(name: string): { label: string; url: string }[]`

- [ ] **Step 1: 실패 테스트 작성** — `apps/api/src/companies/nps.test.ts`

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildLinks,
  estimateAnnualSalaryManwon,
  parseBassItems,
  parseDetail,
  pickWorkplace,
} from './nps';

const norm = (s: string): string =>
  s
    .replace(/\(주\)|\(유\)|주식회사|유한회사|㈜/g, '')
    .replace(/\s+/g, ' ')
    .trim();

test('추정연봉: (고지금액/가입자수)/0.09*12 를 만원으로 반올림', () => {
  // 1인당 월고지 203,400원 → 월소득 2,260,000 → 연 27,120,000 → 2712만원
  assert.equal(estimateAnnualSalaryManwon(203_400, 1), 2712);
});

test('추정연봉: 가입자수 0 또는 금액 결측이면 null', () => {
  assert.equal(estimateAnnualSalaryManwon(100000, 0), null);
  assert.equal(estimateAnnualSalaryManwon(null, 10), null);
});

test('parseBassItems: response.body.items.item 배열을 NpsWorkplace[]로', () => {
  const json = {
    response: {
      body: {
        items: {
          item: [
            {
              seq: '20240001',
              wkplNm: '(주)카카오',
              bzowrRgstNo: '120816****',
              wkplRoadNmDtlAddr: '제주 제주시',
              wkplIntpCd: 'IT',
              dataCrtYm: '202506',
            },
          ],
        },
      },
    },
  };
  const items = parseBassItems(json);
  assert.equal(items.length, 1);
  assert.equal(items[0].seq, '20240001');
  assert.equal(items[0].name, '(주)카카오');
});

test('parseBassItems: 단일 객체(item이 배열 아님)도 1건으로', () => {
  const json = {
    response: { body: { items: { item: { seq: '1', wkplNm: 'A' } } } },
  };
  assert.equal(parseBassItems(json).length, 1);
});

test('parseBassItems: 빈/비정상 응답은 빈 배열', () => {
  assert.deepEqual(parseBassItems({}), []);
  assert.deepEqual(parseBassItems(null), []);
});

test('pickWorkplace: 정규화 완전일치가 정확히 1건이면 그것', () => {
  const items = [
    {
      seq: '1',
      name: '(주)카카오',
      bizno: null,
      address: null,
      industry: null,
      dataYm: null,
    },
    {
      seq: '2',
      name: '카카오모빌리티',
      bizno: null,
      address: null,
      industry: null,
      dataYm: null,
    },
  ];
  const picked = pickWorkplace(items, '카카오', norm);
  assert.equal(picked?.seq, '1');
});

test('pickWorkplace: 완전일치가 복수면 null(보수적)', () => {
  const items = [
    {
      seq: '1',
      name: '카카오',
      bizno: null,
      address: null,
      industry: null,
      dataYm: null,
    },
    {
      seq: '2',
      name: '(주)카카오',
      bizno: null,
      address: null,
      industry: null,
      dataYm: null,
    },
  ];
  assert.equal(pickWorkplace(items, '카카오', norm), null);
});

test('pickWorkplace: 일치 0건이면 null', () => {
  const items = [
    {
      seq: '2',
      name: '네이버',
      bizno: null,
      address: null,
      industry: null,
      dataYm: null,
    },
  ];
  assert.equal(pickWorkplace(items, '카카오', norm), null);
});

test('parseDetail: 가입자수/고지금액/입퇴사 매핑', () => {
  const json = {
    response: {
      body: {
        items: {
          item: {
            jnngpCnt: '7',
            crrmmNtcAmt: '1423800',
            nwAcqzrCnt: '1',
            lssJdgmntCnt: '2',
            wkplIntpCd: '영화·방송',
          },
        },
      },
    },
  };
  const d = parseDetail(json);
  assert.equal(d?.memberCount, 7);
  assert.equal(d?.crrmmNtcAmt, 1423800);
  assert.equal(d?.newThisMonth, 1);
  assert.equal(d?.lostThisMonth, 2);
});

test('buildLinks: 잡플래닛·잡서치·크레딧잡·공고검색 4개', () => {
  const links = buildLinks('카카오');
  assert.equal(links.length, 4);
  for (const l of links) assert.match(l.url, /^https:\/\//);
  assert.ok(links.some((l) => /jobplanet/.test(l.url)));
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @joblog/api exec node --import tsx --test src/companies/nps.test.ts`
Expected: FAIL ("Cannot find module './nps'")

- [ ] **Step 3: 구현** — `apps/api/src/companies/nps.ts`

```ts
// 국민연금 가입사업장 공개데이터 파싱·계산 — 순수 헬퍼 (네트워크 없음, 단위 테스트 대상)
// 숫자는 전부 "국민연금 공개데이터 기반 추정"이다 (호출부에서 출처 표기).

const PENSION_RATE = 0.09; // 국민연금 보험료율 9%

/** (당월고지금액/가입자수)를 1인 월보험료로 보고 월소득→연소득(만원)으로 추정. */
export function estimateAnnualSalaryManwon(
  crrmmNtcAmt: number | null,
  jnngpCnt: number | null,
): number | null {
  if (!crrmmNtcAmt || !jnngpCnt || jnngpCnt <= 0) return null;
  const monthlyIncome = crrmmNtcAmt / jnngpCnt / PENSION_RATE;
  return Math.round((monthlyIncome * 12) / 10000);
}

export interface NpsWorkplace {
  seq: string;
  name: string;
  bizno: string | null;
  address: string | null;
  industry: string | null;
  dataYm: string | null;
}

/** 공공데이터포털 응답에서 items.item을 항상 배열로 꺼낸다. */
function itemsOf(json: unknown): Record<string, unknown>[] {
  const item = (json as any)?.response?.body?.items?.item;
  if (Array.isArray(item)) return item as Record<string, unknown>[];
  if (item && typeof item === 'object')
    return [item as Record<string, unknown>];
  return [];
}

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** getBassInfoSearchV2 응답 → NpsWorkplace[] */
export function parseBassItems(json: unknown): NpsWorkplace[] {
  return itemsOf(json).map((it) => ({
    seq: str(it.seq) ?? '',
    name: str(it.wkplNm) ?? '',
    bizno: str(it.bzowrRgstNo),
    address: str(it.wkplRoadNmDtlAddr) ?? str(it.ldongAddrMgpnDtlCd),
    industry: str(it.wkplIntpCd),
    dataYm: str(it.dataCrtYm),
  }));
}

/** 정규화 키가 완전 일치하는 사업장이 정확히 1건이면 그것, 아니면 null (보수적). */
export function pickWorkplace(
  items: NpsWorkplace[],
  query: string,
  normalize: (s: string) => string,
): NpsWorkplace | null {
  const q = normalize(query);
  const matches = items.filter((w) => w.seq && normalize(w.name) === q);
  return matches.length === 1 ? matches[0] : null;
}

export interface NpsDetail {
  memberCount: number;
  crrmmNtcAmt: number | null;
  newThisMonth: number | null;
  lostThisMonth: number | null;
  industry: string | null;
}

/** getDetailInfoSearchV2 응답 → 상세. 항목 없으면 null. */
export function parseDetail(json: unknown): NpsDetail | null {
  const it = itemsOf(json)[0];
  if (!it) return null;
  return {
    memberCount: num(it.jnngpCnt) ?? 0,
    crrmmNtcAmt: num(it.crrmmNtcAmt),
    newThisMonth: num(it.nwAcqzrCnt),
    lostThisMonth: num(it.lssJdgmntCnt),
    industry: str(it.wkplIntpCd),
  };
}

/** 회사명으로 가는 공개 소스 바로가기 묶음. */
export function buildLinks(name: string): { label: string; url: string }[] {
  const q = encodeURIComponent(name);
  return [
    {
      label: '잡플래닛',
      url: `https://www.jobplanet.co.kr/search?query=${q}&type=companies`,
    },
    { label: '잡서치(좋소력)', url: `https://jotso.net/search?q=${q}` },
    { label: '크레딧잡', url: `https://kreditjob.com/search?q=${q}` },
    {
      label: '채용공고 검색',
      url: `https://www.google.com/search?q=${q}+채용`,
    },
  ];
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @joblog/api exec node --import tsx --test src/companies/nps.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit** (승인 후)

```bash
git add apps/api/src/companies/nps.ts apps/api/src/companies/nps.test.ts
git commit -m "feat(companies): NPS 순수 헬퍼(연봉추정·사업장선택·파서·링크) + 테스트"
```

---

### Task 3: `NpsService` (공공데이터포털 V2 호출, I/O)

**Files:**

- Create: `apps/api/src/companies/nps.service.ts`

**Interfaces:**

- Consumes: `nps.ts`의 `parseBassItems`, `parseDetail`, `pickWorkplace`, `estimateAnnualSalaryManwon`, `NpsWorkplace`.
- Produces: `NpsService.enabled: boolean`, `NpsService.fetchMetrics(name: string, normalize: (s:string)=>string): Promise<NpsMetrics | null>` (타입 `NpsMetrics`는 `@joblog/types`).

- [ ] **Step 1: 구현** — `apps/api/src/companies/nps.service.ts`

> 테스트 전략: 네트워크 호출부는 이 레포 관례상 단위테스트하지 않는다(순수부는 Task 2에서 테스트, 서비스 결선은 Task 6의 통합 구동으로 검증). 아래는 I/O 결선만 담는다.

```ts
import type { NpsMetrics } from '@joblog/types';
import { Injectable, Logger } from '@nestjs/common';

import {
  estimateAnnualSalaryManwon,
  parseBassItems,
  parseDetail,
  pickWorkplace,
} from './nps';

const BASE = 'http://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2';

/** 국민연금 가입사업장 공개데이터 조회. 키 없거나 실패/모호하면 null → 바로가기 폴백. */
@Injectable()
export class NpsService {
  private readonly logger = new Logger(NpsService.name);

  get enabled(): boolean {
    return !!process.env.NPS_API_KEY;
  }

  private async get(
    path: string,
    params: Record<string, string>,
  ): Promise<unknown | null> {
    const qs = new URLSearchParams({
      serviceKey: process.env.NPS_API_KEY ?? '',
      resultType: 'json',
      ...params,
    });
    const res = await fetch(`${BASE}/${path}?${qs.toString()}`);
    if (!res.ok) {
      this.logger.warn(`NPS ${path} ${res.status}`);
      return null;
    }
    return res.json();
  }

  async fetchMetrics(
    name: string,
    normalize: (s: string) => string,
  ): Promise<NpsMetrics | null> {
    if (!this.enabled || !name) return null;
    try {
      const bass = await this.get('getBassInfoSearchV2', {
        wkpl_nm: name,
        pageNo: '1',
        numOfRows: '20',
      });
      const picked = pickWorkplace(parseBassItems(bass), name, normalize);
      if (!picked) return null; // 0건/복수 → 보수적으로 지표 없음

      const detailJson = await this.get('getDetailInfoSearchV2', {
        seq: picked.seq,
      });
      const detail = parseDetail(detailJson);
      if (!detail) return null;

      return {
        memberCount: detail.memberCount,
        estimatedAnnualSalaryManwon: estimateAnnualSalaryManwon(
          detail.crrmmNtcAmt,
          detail.memberCount,
        ),
        newThisMonth: detail.newThisMonth,
        lostThisMonth: detail.lostThisMonth,
        industry: detail.industry ?? picked.industry,
        region: picked.address,
        dataYm: picked.dataYm,
      };
    } catch (e) {
      this.logger.warn(`NPS fetch 실패 (${name}): ${String(e)}`);
      return null;
    }
  }
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm --filter @joblog/api typecheck`
Expected: PASS

> ⚠️ 실행 시 주의: V2 응답의 정확한 필드명(`crrmmNtcAmt`·`nwAcqzrCnt` 등)은 키 연결 후 첫 실호출로 확인한다. 다르면 `nps.ts`의 `parseBassItems`/`parseDetail` 키 매핑만 고치면 되고(순수부), 서비스는 불변. 첫 실호출 때 `this.logger.debug(JSON.stringify(detailJson))`로 raw를 한 번 찍어 확인 권장.

- [ ] **Step 3: Commit** (승인 후)

```bash
git add apps/api/src/companies/nps.service.ts
git commit -m "feat(companies): NpsService 공공데이터포털 V2 조회(우아한 폴백)"
```

---

### Task 4: Prisma `CompanyProfile` 모델 + 마이그레이션

**Files:**

- Modify: `apps/api/prisma/schema.prisma` (CompanyReview 모델 아래, 73행 근처)

**Interfaces:**

- Produces: Prisma 모델 `CompanyProfile { companyName(@id), nps(Json?), fetchedAt }`.

- [ ] **Step 1: 모델 추가**

`model CompanyReview { ... }` 블록 바로 아래에 삽입:

```prisma
// M4 — 회사 지표(국민연금 공개데이터) 캐시. 후기와 출처·수명주기가 달라 분리.
model CompanyProfile {
  companyName String   @id // 정규화 키
  nps         Json? // NpsMetrics 스냅샷 (매칭 모호/실패면 저장 안 함)
  fetchedAt   DateTime @default(now())
}
```

- [ ] **Step 2: 마이그레이션 생성·적용**

Run: `pnpm --filter @joblog/api exec prisma migrate dev --name company_profile`
Expected: 새 마이그레이션 생성 + 적용, Prisma Client 재생성

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter @joblog/api typecheck`
Expected: PASS (`prisma.companyProfile` 사용 가능)

- [ ] **Step 4: Commit** (승인 후)

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(db): CompanyProfile 캐시 모델 + 마이그레이션"
```

---

### Task 5: `CompaniesService.getProfile()` 오케스트레이션

**Files:**

- Modify: `apps/api/src/companies/companies.service.ts`

**Interfaces:**

- Consumes: `NpsService.fetchMetrics`, 기존 `getReviews`, `nps.ts`의 `buildLinks`, `jobplanet.ts`의 `isCacheFresh`.
- Produces: `CompaniesService.getProfile(nameRaw: string): Promise<CompanyProfileDto>`.

- [ ] **Step 1: 생성자에 NpsService 주입 + getProfile 추가**

`companies.service.ts` 상단 import에 추가:

```ts
import type { CompanyProfileDto } from '@joblog/types';
import { NpsService } from './nps.service';
import { buildLinks } from './nps';
```

생성자에 `private nps: NpsService` 추가. 클래스에 메서드 추가:

```ts
/** 회사 통합 프로필: 국민연금 지표(캐시 7일) + 잡플래닛 후기 + 바로가기. */
async getProfile(nameRaw: string): Promise<CompanyProfileDto> {
  const name = this.normalize(nameRaw);
  const links = buildLinks(name || nameRaw);
  if (!name) {
    return { companyName: name, nps: null, review: null, links };
  }

  // 1) 국민연금 지표 (캐시 우선)
  let nps = null as CompanyProfileDto['nps'];
  const cached = await this.prisma.companyProfile.findUnique({
    where: { companyName: name },
  });
  if (cached && isCacheFresh(cached.fetchedAt.getTime(), Date.now())) {
    nps = (cached.nps as CompanyProfileDto['nps']) ?? null;
  } else if (this.nps.enabled) {
    nps = await this.nps.fetchMetrics(name, (s) => this.normalize(s));
    if (nps) {
      await this.prisma.companyProfile.upsert({
        where: { companyName: name },
        update: { nps, fetchedAt: new Date() },
        create: { companyName: name, nps },
      });
    }
  }

  // 2) 잡플래닛 후기 (기존 로직 재사용)
  const review = await this.getReviews(name);

  return {
    companyName: name,
    nps,
    review: {
      rating: review.rating,
      summary: review.summary,
      sourceUrl: review.sourceUrl,
    },
    links,
  };
}
```

`isCacheFresh`가 이미 import돼 있지 않으면 `./jobplanet` import에 추가한다.

- [ ] **Step 2: 타입체크**

Run: `pnpm --filter @joblog/api typecheck`
Expected: PASS

- [ ] **Step 3: Commit** (승인 후)

```bash
git add apps/api/src/companies/companies.service.ts
git commit -m "feat(companies): getProfile — NPS 지표+후기+링크 통합(7일 캐시)"
```

---

### Task 6: 컨트롤러 엔드포인트 + 모듈 결선 + 통합 구동 검증

**Files:**

- Modify: `apps/api/src/companies/companies.controller.ts`
- Modify: `apps/api/src/companies/companies.module.ts`

**Interfaces:**

- Consumes: `CompaniesService.getProfile`, `NpsService`.
- Produces: `GET /companies/profile?name=` (JWT 보호).

- [ ] **Step 1: 모듈 providers에 NpsService 등록**

`companies.module.ts`의 `providers`를 `[CompaniesService, NpsService]`로. 상단에 `import { NpsService } from './nps.service';`.

- [ ] **Step 2: 컨트롤러에 profile 라우트 추가**

`companies.controller.ts`에 JWT 가드를 건 `profile` 핸들러 추가(기존 `reviews`는 공개 유지):

```ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
// ...
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@Query('name') name: string) {
    return this.svc.getProfile(name ?? '');
  }
```

(클래스 레벨 가드가 없으므로 `reviews`는 공개, `profile`만 메서드 가드.)

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter @joblog/api typecheck`
Expected: PASS

- [ ] **Step 4: 통합 구동 검증 (실제 앱)**

API를 띄우고(이미 떠 있으면 재사용), 토큰을 발급해 엔드포인트를 친다. 키(`NPS_API_KEY`)가 없어도 **`nps:null` + `links` 4개 + `review`** 가 오고 500이 없어야 한다(우아한 폴백).

```bash
# 토큰 발급(apps/api): User 1명 upsert 후 JWT 서명 — verify 시 쓰던 방식
# 그다음:
curl -s "http://localhost:4000/companies/profile?name=%EC%B9%B4%EC%B9%B4%EC%98%A4" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool --no-ensure-ascii
```

Expected: `{"companyName":"카카오","nps":null,"review":{...},"links":[4건]}`, HTTP 200.
키가 있으면 `nps`에 지표가 채워지는지 추가 확인.

- [ ] **Step 5: Commit** (승인 후)

```bash
git add apps/api/src/companies/companies.controller.ts apps/api/src/companies/companies.module.ts
git commit -m "feat(companies): GET /companies/profile + NpsService 결선"
```

---

### Task 7: 프론트엔드 확장 패널

**Files:**

- Modify: `apps/web/src/app/applications/[id]/page.tsx`

**Interfaces:**

- Consumes: `CompanyProfileDto`(@joblog/types), `apiFetch`, TanStack Query.

- [ ] **Step 1: import + 상태 + 쿼리 추가**

3행 import 타입에 `CompanyProfileDto` 추가. 컴포넌트 내 `reviews` useQuery를 `profile`로 교체(또는 병행). 패널 토글 상태:

```ts
const [showCompany, setShowCompany] = useState(false);

const profile = useQuery({
  queryKey: ['company-profile', app.data?.companyName],
  queryFn: () =>
    apiFetch<CompanyProfileDto>(
      `/companies/profile?name=${encodeURIComponent(app.data?.companyName ?? '')}`,
    ),
  enabled: showCompany && !!app.data?.companyName,
});
```

- [ ] **Step 2: "기업 후기" 섹션(199~229행)을 회사 패널로 교체**

```tsx
<section className="mt-8">
  <button
    type="button"
    onClick={() => setShowCompany((v) => !v)}
    className="mb-3 flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
  >
    {app.data?.companyName} 회사 정보 {showCompany ? '▲' : '▼'}
  </button>

  {showCompany && (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
      {profile.isLoading && <p className="text-slate-400">불러오는 중…</p>}

      {profile.data?.nps && (
        <div>
          <h3 className="font-semibold text-slate-700">국민연금 공개데이터</h3>
          <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
            <li>직원 수: {profile.data.nps.memberCount}명</li>
            {profile.data.nps.estimatedAnnualSalaryManwon != null && (
              <li>
                추정 평균연봉: {profile.data.nps.estimatedAnnualSalaryManwon}
                만원
              </li>
            )}
            {profile.data.nps.newThisMonth != null && (
              <li>당월 입사: {profile.data.nps.newThisMonth}명</li>
            )}
            {profile.data.nps.lostThisMonth != null && (
              <li>당월 퇴사: {profile.data.nps.lostThisMonth}명</li>
            )}
            {profile.data.nps.industry && (
              <li>업종: {profile.data.nps.industry}</li>
            )}
            {profile.data.nps.region && (
              <li>지역: {profile.data.nps.region}</li>
            )}
          </ul>
          <p className="mt-1 text-xs text-slate-400">
            국민연금 가입사업장 공개데이터 기반 추정
            {profile.data.nps.dataYm ? ` · ${profile.data.nps.dataYm}` : ''}
          </p>
        </div>
      )}

      {profile.data?.review && (
        <div>
          <h3 className="font-semibold text-slate-700">기업 후기</h3>
          <div className="mt-1 flex items-center gap-2">
            {profile.data.review.rating != null ? (
              <span className="font-semibold text-amber-600">
                ★ {profile.data.review.rating.toFixed(1)}
              </span>
            ) : (
              <span className="text-slate-500">
                평점 정보를 바로 가져올 수 없어요.
              </span>
            )}
          </div>
          {profile.data.review.summary && (
            <p className="mt-1 text-slate-600">
              “{profile.data.review.summary}”
            </p>
          )}
        </div>
      )}

      <div>
        <h3 className="font-semibold text-slate-700">바로가기</h3>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {(profile.data?.links ?? []).map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="text-brand hover:underline"
            >
              {l.label} ↗
            </a>
          ))}
        </div>
      </div>
    </div>
  )}
</section>
```

기존 `reviews` useQuery가 더 쓰이지 않으면 제거한다.

- [ ] **Step 3: 웹 타입체크/린트**

Run: `pnpm --filter @joblog/web typecheck` (없으면 `pnpm --filter @joblog/web build`)
Expected: PASS

- [ ] **Step 4: 수동 확인 (실제 화면)**

web dev 서버에서 지원 상세 진입 → 회사명 토글 클릭 → 패널 펼쳐지고 바로가기 4개 표시(키 없으면 지표 블록은 숨고 바로가기만). 콘솔 에러 없음.

- [ ] **Step 5: Commit** (승인 후)

```bash
git add apps/web/src/app/applications/[id]/page.tsx
git commit -m "feat(web): 회사 정보 확장 패널(국민연금 지표+후기+바로가기)"
```

---

## 마무리

- [ ] `.env.example`에 `NPS_API_KEY=""`(공공데이터포털 인증키) 1줄 추가 + 주석("없으면 바로가기만 표시").
- [ ] `task.md` M4에 "회사 정보 패널(국민연금 공개데이터)" 항목 체크, `spec.md` §6에 profile 엔드포인트·출처 반영.
- [ ] 키 연결 후: 실제 회사명으로 `GET /companies/profile` 호출해 V2 필드 매핑 검증, 어긋나면 `nps.ts` 파서만 보정.

## Self-Review 결과

- **스펙 커버리지:** §3 데이터소스→Task2/3, §4 엔티티해소→Task2(pickWorkplace)/3, §5 API→Task1/6, §6 캐시→Task4/5, §7 프론트→Task7, §8 폴백→Task3/5/6-Step4, §9 테스트→Task2. 전부 매핑됨.
- **플레이스홀더:** 없음(모든 코드 블록 실내용). V2 필드명 확인은 "마무리"의 명시적 후속 스텝으로 분리(순수부만 수정).
- **타입 일관성:** `NpsMetrics`(Task1) ↔ `NpsService.fetchMetrics` 반환(Task3) ↔ `getProfile`의 `nps`(Task5) ↔ 프론트 사용(Task7) 필드명 일치. `estimateAnnualSalaryManwon`·`pickWorkplace`·`parseBassItems`·`parseDetail`·`buildLinks` 시그니처가 Task2 정의와 Task3/5 사용에서 동일.

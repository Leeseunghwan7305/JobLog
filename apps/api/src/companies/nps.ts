// 국민연금 가입사업장 공개데이터 파싱·계산 — 순수 헬퍼 (네트워크 없음, 단위 테스트 대상)
// 숫자는 전부 "국민연금 공개데이터 기반 추정"이다 (호출부에서 출처 표기).

import type { CompanySearchResult, NpsMonthly } from '@joblog/types';

const PENSION_RATE = 0.09; // 국민연금 보험료율 9%

/** (당월고지금액/가입자수)를 1인 월보험료로 보고 월소득→연소득(만원)으로 추정. */
export function estimateAnnualSalaryManwon(
  crrmmNtcAmt: number | null,
  jnngpCnt: number | null,
): number | null {
  if (crrmmNtcAmt == null || !jnngpCnt || jnngpCnt <= 0) return null;
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** 공공데이터포털 응답에서 items.item을 항상 Record 배열로 꺼낸다 (any 없이 단계적 narrowing). */
function itemsOf(json: unknown): Record<string, unknown>[] {
  if (!isRecord(json)) return [];
  const response = json.response;
  if (!isRecord(response)) return [];
  const body = response.body;
  if (!isRecord(body)) return [];
  const items = body.items;
  if (!isRecord(items)) return [];
  const item = items.item;
  if (Array.isArray(item)) return item.filter(isRecord);
  if (isRecord(item)) return [item];
  return [];
}

const str = (v: unknown): string | null => {
  // NPS 응답 필드는 문자열/숫자만 온다. 그 외(객체 등)는 버린다 — '[object Object]' 방지.
  if (typeof v === 'string') return v.trim() === '' ? null : v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
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
  const matches = items.filter((w) => w.seq !== '' && normalize(w.name) === q);
  return matches.length === 1 ? matches[0] : null;
}

export interface NpsDetail {
  memberCount: number; // jnngpCnt 가입자수
  crrmmNtcAmt: number | null; // 당월고지금액
  industry: string | null; // vldtVlKrnNm 업종명
  dataYm: string | null; // dataCrtYm (상세엔 없을 수 있음)
}

/** getDetailInfoSearchV2 응답 → 상세. 항목 없으면 null. */
export function parseDetail(json: unknown): NpsDetail | null {
  const list = itemsOf(json);
  if (list.length === 0) return null;
  const it = list[0];
  return {
    memberCount: num(it.jnngpCnt) ?? 0,
    crrmmNtcAmt: num(it.crrmmNtcAmt),
    industry: str(it.vldtVlKrnNm),
    dataYm: str(it.dataCrtYm),
  };
}

export interface NpsPeriod {
  joined: number | null; // nwAcqzrCnt 신규 취득자수(입사)
  left: number | null; // lssJnngpCnt 상실 가입자수(퇴사)
}

/** getPdAcctoSttusInfoSearchV2 응답 → 당월 입/퇴. 항목 없으면 둘 다 null. */
export function parsePeriod(json: unknown): NpsPeriod {
  const it = itemsOf(json)[0];
  if (!it) return { joined: null, left: null };
  return { joined: num(it.nwAcqzrCnt), left: num(it.lssJnngpCnt) };
}

/** YYYYMM에서 최근 n개월(내림차순, 자신 포함). 파싱 불가하면 [latestYm]. */
export function recentYms(latestYm: string, n: number): string[] {
  const y = Number(latestYm.slice(0, 4));
  const m = Number(latestYm.slice(4, 6));
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    return [latestYm];
  }
  const out: string[] = [];
  let yy = y;
  let mm = m;
  for (let i = 0; i < n; i++) {
    out.push(`${yy}${String(mm).padStart(2, '0')}`);
    mm -= 1;
    if (mm === 0) {
      mm = 12;
      yy -= 1;
    }
  }
  return out;
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
    { label: '채용공고 검색', url: `https://www.google.com/search?q=${q}+채용` },
  ];
}

/** 검색 후보: seq 있는 사업장만 노출용으로 매핑. */
export function toSearchResults(items: NpsWorkplace[]): CompanySearchResult[] {
  return items
    .filter((w) => w.seq)
    .map((w) => ({
      seq: w.seq,
      name: w.name,
      region: w.address,
      industry: w.industry,
    }));
}

/** 회사 식별 키 (이름+사업자번호+주소). bass가 회사×월로 행을 돌려주므로 묶는 데 쓴다. */
function companyKey(w: NpsWorkplace): string {
  return `${w.name}|${w.bizno ?? ''}|${w.address ?? ''}`;
}

/** 월별 중복 행을 회사 단위로 묶어 후보 1개씩(대표 seq=최신월). */
export function groupCompanies(items: NpsWorkplace[]): CompanySearchResult[] {
  const latest = new Map<string, NpsWorkplace>();
  for (const w of items) {
    if (!w.seq) continue;
    const k = companyKey(w);
    const prev = latest.get(k);
    if (!prev || (w.dataYm ?? '') > (prev.dataYm ?? '')) latest.set(k, w);
  }
  return [...latest.values()].map((w) => ({
    seq: w.seq,
    name: w.name,
    region: w.address,
    industry: w.industry,
  }));
}

/** 주어진 seq가 속한 회사의 월별 행들을 최신월 내림차순으로. */
export function companyMonths(
  items: NpsWorkplace[],
  seq: string,
): NpsWorkplace[] {
  const target = items.find((w) => w.seq === seq);
  if (!target) return [];
  const k = companyKey(target);
  return items
    .filter((w) => w.seq && companyKey(w) === k)
    .sort((a, b) => (b.dataYm ?? '').localeCompare(a.dataYm ?? ''));
}

export interface NpsMonthSnapshot {
  ym: string;
  memberCount: number;
  crrmmNtcAmt: number | null;
  joined: number | null;
  left: number | null;
}

/** 월별 스냅샷 → 추이(ym 오름차순) + 최신월 회전율(%). 빈 입력이면 추이 []·회전율 null. */
export function computeTrends(snapshots: NpsMonthSnapshot[]): {
  trend: NpsMonthly[];
  turnoverRatePct: number | null;
} {
  const sorted = [...snapshots].sort((a, b) => a.ym.localeCompare(b.ym));
  const trend: NpsMonthly[] = sorted.map((s) => ({
    ym: s.ym,
    memberCount: s.memberCount,
    joined: s.joined,
    left: s.left,
    estimatedAnnualSalaryManwon: estimateAnnualSalaryManwon(
      s.crrmmNtcAmt,
      s.memberCount,
    ),
  }));
  const latest = sorted.at(-1);
  let turnoverRatePct: number | null = null;
  if (latest && latest.memberCount > 0) {
    const inOut = (latest.joined ?? 0) + (latest.left ?? 0);
    turnoverRatePct = Math.round((inOut / latest.memberCount) * 1000) / 10;
  }
  return { trend, turnoverRatePct };
}

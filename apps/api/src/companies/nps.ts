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

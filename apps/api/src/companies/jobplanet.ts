// 잡플래닛 스크래핑 결과(마크다운) 파싱 — 순수 헬퍼 (네트워크 없음, 단위 테스트 대상)
// 실제 잡플래닛 마크다운 구조 기준으로 튜닝됨:
//  - 검색 결과: `**회사명** … /companies/<id>`
//  - 회사 페이지: `전체 리뷰 통계 (N명)  3.8`

export const JOBPLANET_BASE = 'https://www.jobplanet.co.kr';
export const CACHE_TTL_DAYS = 7;
/** 잡플래닛 검색 결과는 JS 렌더라 Firecrawl waitFor가 필요 */
export const SCRAPE_WAIT_MS = 5000;

export interface CompanyCandidate {
  id: string;
  name: string;
  url: string;
}

export interface RatingSummary {
  rating: number | null;
  summary: string | null;
}

export function searchUrl(name: string): string {
  return `${JOBPLANET_BASE}/search?query=${encodeURIComponent(name)}&type=companies`;
}

export function companyUrl(id: string): string {
  return `${JOBPLANET_BASE}/companies/${id}`;
}

/**
 * 검색 결과 마크다운에서 (회사명, id) 후보 추출.
 * `**이름**` 뒤 300자 내의 `/companies/<id>` 링크를 쌍으로 잡고, id 기준 dedup(첫 이름 유지).
 */
export function extractCompanyCandidates(markdown: string): CompanyCandidate[] {
  const re = /\*\*([^*]{1,60})\*\*[\s\S]{0,300}?\/companies\/(\d+)/g;
  const byId = new Map<string, CompanyCandidate>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const name = m[1].trim();
    const id = m[2];
    if (!byId.has(id)) byId.set(id, { id, name, url: companyUrl(id) });
  }
  return [...byId.values()];
}

/**
 * query와 이름이 (정규화 기준) 정확히 일치하는 첫 후보를 고른다.
 * 동명 복수는 첫 번째(검색 상위 = 보통 본사)를 택하는 best-effort. 일치 없으면 null → 딥링크.
 */
export function pickCandidate(
  candidates: CompanyCandidate[],
  query: string,
  normalize: (s: string) => string,
): CompanyCandidate | null {
  const q = normalize(query);
  for (const c of candidates) {
    if (normalize(c.name) === q) return c;
  }
  return null;
}

/** 회사 페이지 마크다운에서 공개 평점(0~5)과 한줄 요약(있으면) 파싱. */
export function parseRatingSummary(markdown: string): RatingSummary {
  return { rating: parseRating(markdown), summary: parseSummary(markdown) };
}

function parseRating(markdown: string): number | null {
  const patterns = [
    // 잡플래닛 회사 페이지: "전체 리뷰_ 통계 (1308명)  3.8"
    /전체\s*리뷰[^()]*\([^)]*\)\s*([0-5](?:\.\d)?)/,
    /(?:총점|평점|별점)[^\d]{0,12}([0-5](?:\.\d)?)/,
    /★\s*([0-5](?:\.\d)?)/,
  ];
  for (const re of patterns) {
    const m = re.exec(markdown);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 0 && n <= 5) {
        return Math.round(n * 10) / 10;
      }
    }
  }
  return null;
}

function parseSummary(markdown: string): string | null {
  const m = /한줄평[:\s]*([^\n]{5,120})/.exec(markdown);
  if (!m) return null;
  const s = m[1].replace(/[*_>#]/g, '').trim();
  return s.length >= 5 ? s : null;
}

/** 캐시 신선도: fetchedAt 이후 ttlDays 이내면 true. */
export function isCacheFresh(
  fetchedAtMs: number,
  nowMs: number,
  ttlDays = CACHE_TTL_DAYS,
): boolean {
  return nowMs - fetchedAtMs < ttlDays * 86_400_000;
}

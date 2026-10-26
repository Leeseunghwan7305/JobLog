// 잡플래닛 스크래핑 결과(마크다운)를 파싱하는 순수 헬퍼. (네트워크 없음 → 단위 테스트 대상)
// 실제 HTML 파싱 품질은 실키 연결 후 수동 튜닝 (task.md). 여기선 분기 로직을 결정적으로 고정한다.

export const JOBPLANET_BASE = 'https://www.jobplanet.co.kr';
export const CACHE_TTL_DAYS = 7;

export interface CompanyCandidate {
  id: string;
  name: string;
  url: string;
}

export interface RatingSummary {
  rating: number | null;
  summary: string | null;
}

/**
 * 잡플래닛 검색 결과 마크다운에서 회사 후보를 추출한다.
 * `/companies/<id>` 링크를 회사 id 기준으로 dedup (리뷰·연봉 등 하위 링크는 같은 회사로 합쳐짐).
 */
export function extractCompanyCandidates(markdown: string): CompanyCandidate[] {
  const byId = new Map<string, CompanyCandidate>();
  // 마크다운 링크: [name](url …/companies/<id>…)
  const re = /\[([^\]]+)\]\(([^)]*\/companies\/(\d+)[^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const [, rawName, rawUrl, id] = m;
    const name = rawName.trim();
    if (byId.has(id)) continue;
    const url = rawUrl.startsWith('http')
      ? `${JOBPLANET_BASE}/companies/${id}`
      : `${JOBPLANET_BASE}/companies/${id}`;
    byId.set(id, { id, name, url });
  }
  return [...byId.values()];
}

/**
 * 잡플래닛 회사 페이지 마크다운에서 공개 평점(0~5)과 짧은 요약을 best-effort로 파싱.
 * 확신 없으면 null (틀린 정보를 보여주느니 비움 — spec 6.1).
 */
export function parseRatingSummary(markdown: string): RatingSummary {
  return { rating: parseRating(markdown), summary: parseSummary(markdown) };
}

function parseRating(markdown: string): number | null {
  // 총점/평점/별점 키워드 뒤의 X.X, 또는 ★ X.X
  const patterns = [
    /(?:총점|평점|별점|기업\s*평점)[^\d]{0,12}(\d(?:\.\d)?)/,
    /★\s*(\d(?:\.\d)?)/,
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
  // "한줄평"/"기업 한줄평" 마커 뒤 한 줄만 (전체 후기 본문은 수집하지 않음)
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

/** 정규화된 회사명으로 잡플래닛 검색 딥링크. */
export function searchUrl(name: string): string {
  return `${JOBPLANET_BASE}/search?query=${encodeURIComponent(name)}`;
}

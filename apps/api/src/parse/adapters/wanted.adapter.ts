// Wanted 사이트 어댑터 — 순수 헬퍼(네트워크 없음, 단위 테스트 대상).
// 렌더된 페이지는 '채용 절차'를 이미지로 두는 경우가 많아 Firecrawl 마크다운에 안 잡힌다.
// 반면 chaos API(JSON)의 detail.hire_rounds엔 전형이 텍스트로 완전히 들어있다.
// → Wanted 공고는 이 API를 긁어 구조화 텍스트로 만들어 LLM에 넘긴다(수집 커버리지↑).

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/** Wanted 공고 URL → 공고 id. 아니면 null. */
export function matchWantedId(url: string): string | null {
  const m = /wanted\.co\.kr\/wd\/(\d+)/.exec(url);
  return m ? m[1] : null;
}

/** 공고 id → chaos details API URL. */
export function wantedApiUrl(id: string): string {
  return `https://www.wanted.co.kr/api/chaos/jobs/v4/${id}/details`;
}

/** 스크랩 마크다운(```json … ``` 래핑)에서 JSON 객체만 뽑아 파싱. 실패 시 null. */
export function extractJson(markdown: string): unknown {
  const s = markdown.indexOf('{');
  const e = markdown.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try {
    return JSON.parse(markdown.slice(s, e + 1));
  } catch {
    return null;
  }
}

/**
 * chaos API JSON → LLM에 넘길 구조화 텍스트. 핵심은 detail.hire_rounds(채용 절차).
 * 회사/직무가 둘 다 없으면 신뢰 못 할 응답으로 보고 null(→ 일반 수집 폴백).
 */
export function buildWantedText(json: unknown): string | null {
  const data = isRecord(json) ? json.data : undefined;
  const job = isRecord(data) ? data.job : undefined;
  if (!isRecord(job)) return null;
  const detail = isRecord(job.detail) ? job.detail : {};
  const company = isRecord(job.company) ? job.company : {};
  const address = isRecord(job.address) ? job.address : {};

  const companyName = str(company.name);
  const position = str(detail.position);
  if (!companyName && !position) return null;

  const lines: string[] = [];
  if (companyName) lines.push(`회사명: ${companyName}`);
  if (position) lines.push(`직무: ${position}`);
  const loc = str(address.full_location);
  if (loc) lines.push(`근무지: ${loc}`);
  const due = str(job.due_time);
  if (due) lines.push(`마감일: ${due.slice(0, 10)}`);
  const emp = str(job.employment_type);
  if (emp) lines.push(`고용형태: ${emp}`);

  const section = (title: string, v: unknown): void => {
    const body = str(v);
    if (body) lines.push('', `[${title}]`, body);
  };
  section('포지션 소개', detail.intro);
  section('주요업무', detail.main_tasks);
  section('자격요건', detail.requirements);
  section('우대사항', detail.preferred_points);
  section('채용 절차', detail.hire_rounds); // ← 전형(렌더 페이지엔 이미지)
  section('혜택', detail.benefits);
  return lines.join('\n');
}

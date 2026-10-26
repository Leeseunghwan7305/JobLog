import type { ParsedPosting } from '@joblog/types';

// 공유 타입은 @joblog/types가 유일한 정의처(source of truth).
// api는 이를 재노출하고, 런타임 헬퍼(정규화·기본값)만 여기서 소유한다.
export type { ParsedPosting, ParseResponse } from '@joblog/types';

export const DEFAULT_STAGES = [
  { name: '서류', order: 0 },
  { name: '면접', order: 1 },
  { name: '최종', order: 2 },
];

/** unknown 값을 안전하게 문자열로. 문자열·유한 숫자만 받고 그 외엔 빈 문자열. */
function asString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

/** 값이 있으면 문자열로, 비어 있으면 null. */
function asStringOrNull(v: unknown): string | null {
  const s = asString(v);
  return s === '' ? null : s;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * 마감일을 YYYY-MM-DD로 정규화. 날짜로 해석할 수 없으면 null.
 * 모델이 "마감일 정보가 제공되지 않았습니다"·"상시채용" 같은 문장/표현을 돌려줘도
 * 여기서 null로 떨궈, 저장 시 `new Date(문장)`이 Invalid Date가 되는 것을 막는다.
 * 지원 형식: YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD / YYYY년 MM월 DD일 (한 자리 월·일 허용)
 */
function normalizeDeadline(v: unknown): string | null {
  const s = asString(v).trim();
  if (!s) return null;
  const m = /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  // 13월·32일 등 달력상 존재하지 않는 날짜는 거부
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** 단계명에서 모델이 흔히 덧붙이는 감싸는 괄호([],(),「」,『』,【】)를 벗기고 trim. */
function cleanStageName(name: string): string {
  return name
    .trim()
    .replace(/^[[(「『【]+/, '')
    .replace(/[\])」』】]+$/, '')
    .trim();
}

interface RawStage {
  name?: unknown;
  order?: unknown;
}

/** LLM이 돌려준 원시 객체를 안전한 ParsedPosting으로 정규화 (provider 공용) */
export function normalizeParsed(input: Record<string, unknown>): ParsedPosting {
  const rawStages: unknown[] = Array.isArray(input.stages) ? input.stages : [];
  const stages =
    rawStages.length > 0
      ? rawStages
          .map((s, i) => {
            const stage = (
              typeof s === 'object' && s !== null ? s : {}
            ) as RawStage;
            return {
              name: cleanStageName(asString(stage.name)) || `단계 ${i + 1}`,
              // 모델이 준 order는 정렬 기준으로만 쓰고(1-based·비연속 가능),
              // 실제 order는 아래서 0-based 연속으로 재매김한다.
              sortKey:
                typeof stage.order === 'number' && Number.isFinite(stage.order)
                  ? stage.order
                  : i,
            };
          })
          .sort((a, b) => a.sortKey - b.sortKey)
          .map((s, i) => ({ name: s.name, order: i }))
      : DEFAULT_STAGES;
  return {
    companyName: asString(input.companyName),
    position: asString(input.position),
    location: asStringOrNull(input.location),
    employmentType: asStringOrNull(input.employmentType),
    deadline: normalizeDeadline(input.deadline),
    stages,
    confidence: input.confidence === 'high' ? 'high' : 'low',
  };
}

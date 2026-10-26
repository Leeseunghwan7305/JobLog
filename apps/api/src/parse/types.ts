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

interface RawStage {
  name?: unknown;
  order?: unknown;
}

/** LLM이 돌려준 원시 객체를 안전한 ParsedPosting으로 정규화 (provider 공용) */
export function normalizeParsed(input: Record<string, unknown>): ParsedPosting {
  const rawStages: unknown[] = Array.isArray(input.stages) ? input.stages : [];
  const stages =
    rawStages.length > 0
      ? rawStages.map((s, i) => {
          const stage = (
            typeof s === 'object' && s !== null ? s : {}
          ) as RawStage;
          return {
            name: asString(stage.name) || `단계 ${i + 1}`,
            order:
              typeof stage.order === 'number' && Number.isFinite(stage.order)
                ? stage.order
                : i,
          };
        })
      : DEFAULT_STAGES;
  return {
    companyName: asString(input.companyName),
    position: asString(input.position),
    location: asStringOrNull(input.location),
    employmentType: asStringOrNull(input.employmentType),
    deadline: asStringOrNull(input.deadline),
    stages,
    confidence: input.confidence === 'high' ? 'high' : 'low',
  };
}

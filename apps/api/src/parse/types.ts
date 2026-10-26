export interface ParsedPosting {
  companyName: string;
  position: string;
  location: string | null;
  employmentType: string | null;
  deadline: string | null;
  stages: { name: string; order: number }[];
  confidence: 'high' | 'low';
}

export interface ParseResponse {
  draft: ParsedPosting;
  needsManualInput: boolean;
  notice?: string;
}

export const DEFAULT_STAGES = [
  { name: '서류', order: 0 },
  { name: '면접', order: 1 },
  { name: '최종', order: 2 },
];

/** LLM이 돌려준 원시 객체를 안전한 ParsedPosting으로 정규화 (provider 공용) */
export function normalizeParsed(input: Record<string, unknown>): ParsedPosting {
  const rawStages = Array.isArray(input.stages) ? input.stages : [];
  const stages =
    rawStages.length > 0
      ? rawStages.map((s: any, i: number) => ({
          name: String(s?.name ?? `단계 ${i + 1}`),
          order: Number.isFinite(s?.order) ? Number(s.order) : i,
        }))
      : DEFAULT_STAGES;
  return {
    companyName: String(input.companyName ?? ''),
    position: String(input.position ?? ''),
    location: input.location ? String(input.location) : null,
    employmentType: input.employmentType ? String(input.employmentType) : null,
    deadline: input.deadline ? String(input.deadline) : null,
    stages,
    confidence: input.confidence === 'high' ? 'high' : 'low',
  };
}

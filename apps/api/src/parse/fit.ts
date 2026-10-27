import type { FitResult } from '@joblog/types';

export interface FitInput {
  resumeText: string;
  companyName: string;
  position: string;
  posting: string; // rawPosting (없을 수 있음)
  reviewSummary?: string | null;
}

// json_object 모드라 스키마는 프롬프트로 안내한다(응답은 JSON 객체 하나).
const FIT_JSON_SHAPE =
  '{"techFit":{"score": 0~100 정수, "matched":[string], "missing":[string], "note": string}, ' +
  '"cultureFit":{"score": 0~100 정수, "rationale": string, "basis": string}, ' +
  '"recommendations":[string], "summary": string}';

export function fitSystemPrompt(): string {
  return (
    '너는 채용 지원을 돕는 커리어 코치다. 지원자의 이력서와 채용 공고(및 회사 후기 요약)를 비교해 적합도를 평가한다. ' +
    `반드시 다음 JSON 객체 하나로만 답한다(JSON 외 텍스트 금지): ${FIT_JSON_SHAPE}. ` +
    '규칙: ' +
    '1) techFit = 이력서의 기술스택·경험이 공고의 자격요건/우대사항과 얼마나 맞는지. matched=이력서에서 확인되는 충족 역량, missing=공고가 요구하지만 이력서에서 안 보이는 것, note=한 줄 평. ' +
    '2) cultureFit = 공고의 인재상/요구 태도·가치(자격요건·우대·"우리가 찾는 사람"·조직문화 언급)와 회사 후기 요약을 근거로 추정한 적합도. rationale=근거, basis=판단 근거의 출처와 한계(예: "공고에 인재상 명시가 적어 제한적"). ' +
    '3) recommendations = 서류·면접 준비 추천(부족 역량 보완, 강조할 강점, 예상 질문 대비 등) 3~6개. ' +
    '4) summary = 한두 문장 종합. ' +
    '5) 점수는 0~100 정수, 근거 없이 과장하지 말고 보수적으로. 모든 텍스트는 한국어. ' +
    '6) 이력서나 공고 정보가 부족하면 그 한계를 note/basis에 솔직히 적어라.'
  );
}

export function fitUserPrompt(input: FitInput): string {
  const posting = input.posting.trim()
    ? input.posting.slice(0, 12000)
    : `(공고 원문 없음 — 회사명·직무만 제공)`;
  const review = input.reviewSummary?.trim()
    ? `[회사 후기 요약]\n${input.reviewSummary}\n\n`
    : '';
  return (
    `[지원 회사] ${input.companyName}\n[직무] ${input.position}\n\n` +
    review +
    `[채용 공고]\n${posting}\n\n` +
    `[내 이력서]\n${input.resumeText.slice(0, 16000)}`
  );
}

function clampScore(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x : String(x)).trim())
    .filter((s) => s.length > 0)
    .slice(0, 20);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** LLM 원시 JSON → 안전한 FitResult (점수 클램프·배열/문자열 보정). */
export function normalizeFit(raw: Record<string, unknown>): FitResult {
  const tech = (
    typeof raw.techFit === 'object' && raw.techFit !== null ? raw.techFit : {}
  ) as Record<string, unknown>;
  const culture = (
    typeof raw.cultureFit === 'object' && raw.cultureFit !== null
      ? raw.cultureFit
      : {}
  ) as Record<string, unknown>;
  return {
    techFit: {
      score: clampScore(tech.score),
      matched: strArray(tech.matched),
      missing: strArray(tech.missing),
      note: str(tech.note),
    },
    cultureFit: {
      score: clampScore(culture.score),
      rationale: str(culture.rationale),
      basis: str(culture.basis),
    },
    recommendations: strArray(raw.recommendations),
    summary: str(raw.summary),
  };
}

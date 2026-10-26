import { type ParsedPosting } from '../types';

/**
 * 파싱 결과 채점기 (순수 함수, 외부 의존 없음).
 *
 * JobLog의 핵심 기능은 "공고 본문 → 구조화"인데 LLM 출력은 비결정적이다.
 * 그래서 골든(expected) 대비 필드 단위로 점수를 매겨 루프의 "정답 신호"로 삼는다.
 * 이 모듈은 네트워크·DI 없이 돌아가므로 node --test로 그대로 검증된다.
 */

export interface FieldScores {
  companyName: number;
  position: number;
  location: number;
  employmentType: number;
  deadline: number;
  stages: number; // 전형 단계 이름 집합의 Jaccard (0~1)
  stageOrderExact: number; // 단계 순서까지 정확히 일치하면 1
  confidence: number;
}

export interface FixtureScore {
  overall: number; // 가중 평균 (0~1)
  fields: FieldScores;
  failedFields: string[]; // 1점 미만인 필드 이름
}

/** 전형 단계가 JobLog의 급소이므로 가중치를 크게 준다. */
const WEIGHTS: Record<keyof FieldScores, number> = {
  companyName: 1,
  position: 1,
  stages: 3,
  stageOrderExact: 1,
  confidence: 0.5,
  location: 0.5,
  employmentType: 0.5,
  deadline: 0.5,
};

/** 문자열 정규화: 전각/반각 통일, 공백 정리, 대소문자 무시. */
function norm(s: string | null | undefined): string {
  return (s ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** 널 허용 문자열 비교: 둘 다 비어있어도 일치로 본다. */
function nullableEq(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  return norm(a) === norm(b) ? 1 : 0;
}

/** 전형 단계 이름 집합의 Jaccard 유사도 (순서 무시). */
function stageSetScore(
  expected: ParsedPosting['stages'],
  actual: ParsedPosting['stages'],
): number {
  const e = new Set(expected.map((s) => norm(s.name)));
  const a = new Set(actual.map((s) => norm(s.name)));
  if (e.size === 0 && a.size === 0) return 1;
  let inter = 0;
  for (const name of a) if (e.has(name)) inter++;
  const union = new Set([...e, ...a]).size;
  return union === 0 ? 1 : inter / union;
}

/** 단계 이름을 order 순으로 늘어놓은 시퀀스가 완전히 같은가. */
function stageOrderScore(
  expected: ParsedPosting['stages'],
  actual: ParsedPosting['stages'],
): number {
  const seq = (st: ParsedPosting['stages']) =>
    [...st]
      .sort((x, y) => x.order - y.order)
      .map((s) => norm(s.name))
      .join(' > ');
  return seq(expected) === seq(actual) ? 1 : 0;
}

/** 한 건의 expected/actual을 필드별로 채점하고 가중 평균을 낸다. */
export function scoreParsed(
  expected: ParsedPosting,
  actual: ParsedPosting,
): FixtureScore {
  const fields: FieldScores = {
    companyName:
      norm(expected.companyName) === norm(actual.companyName) ? 1 : 0,
    position: norm(expected.position) === norm(actual.position) ? 1 : 0,
    location: nullableEq(expected.location, actual.location),
    employmentType: nullableEq(expected.employmentType, actual.employmentType),
    deadline: nullableEq(expected.deadline, actual.deadline),
    stages: stageSetScore(expected.stages, actual.stages),
    stageOrderExact: stageOrderScore(expected.stages, actual.stages),
    confidence: expected.confidence === actual.confidence ? 1 : 0,
  };

  let weighted = 0;
  let total = 0;
  for (const k of Object.keys(WEIGHTS) as (keyof FieldScores)[]) {
    weighted += fields[k] * WEIGHTS[k];
    total += WEIGHTS[k];
  }

  const failedFields = (Object.keys(fields) as (keyof FieldScores)[])
    .filter((k) => fields[k] < 1)
    .map(String);

  return { overall: total === 0 ? 0 : weighted / total, fields, failedFields };
}

/** 여러 건의 점수를 집계해 전체 평균과 필드별 평균을 낸다. */
export function aggregate(scores: FixtureScore[]): {
  meanOverall: number;
  fieldMeans: FieldScores;
} {
  const empty: FieldScores = {
    companyName: 0,
    position: 0,
    location: 0,
    employmentType: 0,
    deadline: 0,
    stages: 0,
    stageOrderExact: 0,
    confidence: 0,
  };
  if (scores.length === 0) return { meanOverall: 0, fieldMeans: empty };

  const fieldMeans = { ...empty };
  let sum = 0;
  for (const s of scores) {
    sum += s.overall;
    for (const k of Object.keys(empty) as (keyof FieldScores)[]) {
      fieldMeans[k] += s.fields[k];
    }
  }
  for (const k of Object.keys(empty) as (keyof FieldScores)[]) {
    fieldMeans[k] /= scores.length;
  }
  return { meanOverall: sum / scores.length, fieldMeans };
}

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { ClaudeService } from '../claude.service';
import { OllamaService } from '../ollama.service';
import { LlmService } from '../llm.service';
import { ParsedPosting } from '../types';
import { scoreParsed, aggregate, FixtureScore } from './score';

/**
 * 파싱 eval 러너 — 루프 엔지니어링의 심장.
 *
 * fixtures/<name>.input.txt (공고 본문) + <name>.expected.json (사람이 검수한 정답)을
 * 실제 파서(LlmService, API와 동일한 코드 경로)에 통과시켜 필드 정확도를 채점한다.
 *
 *   pnpm --filter @joblog/api parse:eval
 *
 * 프로바이더는 API와 같은 env 규칙을 따른다 (LLM_PROVIDER / ANTHROPIC_API_KEY).
 * 평균 점수가 기준(PARSE_EVAL_THRESHOLD, 기본 0.7) 미만이면 종료코드 1 → CI/루프 신호.
 */

const FIXTURES_DIR = join(__dirname, 'fixtures');
const THRESHOLD = Number(process.env.PARSE_EVAL_THRESHOLD ?? '0.7');

interface Fixture {
  name: string;
  input: string;
  expected: ParsedPosting;
}

function loadFixtures(): Fixture[] {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.input.txt'))
    .map((f) => {
      const name = f.replace(/\.input\.txt$/, '');
      const input = readFileSync(join(FIXTURES_DIR, f), 'utf8');
      const expectedPath = join(FIXTURES_DIR, `${name}.expected.json`);
      if (!existsSync(expectedPath)) {
        throw new Error(`정답 파일 없음: ${name}.expected.json`);
      }
      const expected = JSON.parse(readFileSync(expectedPath, 'utf8')) as ParsedPosting;
      return { name, input, expected };
    });
}

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`.padStart(4);
}

async function main(): Promise<void> {
  const llm = new LlmService(new ClaudeService(), new OllamaService());

  console.log(`\n■ JobLog 파싱 eval  (provider=${llm.provider}, threshold=${pct(THRESHOLD)})\n`);

  if (!llm.enabled) {
    console.log('ⓘ LLM 프로바이더가 꺼져 있어(none) 실제 채점을 건너뜁니다.');
    console.log('  ANTHROPIC_API_KEY를 설정하거나 LLM_PROVIDER=ollama + 로컬 ollama로 돌리세요.');
    console.log('  (채점 로직 자체는 `pnpm --filter @joblog/api test`로 검증됩니다.)\n');
    return;
  }

  const fixtures = loadFixtures();
  if (fixtures.length === 0) {
    console.log('ⓘ fixtures/ 가 비어 있습니다. <name>.input.txt + <name>.expected.json 을 추가하세요.');
    console.log('  실패했던 실제 공고를 계속 쌓는 게 이 하네스의 사용법입니다.\n');
    return;
  }

  const scores: FixtureScore[] = [];
  const parseFailures: string[] = [];

  for (const fx of fixtures) {
    const actual = await llm.parse(fx.input);
    if (!actual) {
      parseFailures.push(fx.name);
      console.log(`  ✗ ${fx.name.padEnd(24)} 파싱 실패(null) — 수집/프로바이더 확인`);
      continue;
    }
    const s = scoreParsed(fx.expected, actual);
    scores.push(s);
    const mark = s.overall >= THRESHOLD ? '✓' : '△';
    const failed = s.failedFields.length ? `  틀림: ${s.failedFields.join(', ')}` : '';
    console.log(`  ${mark} ${fx.name.padEnd(24)} ${pct(s.overall)}${failed}`);
  }

  if (scores.length === 0) {
    console.log('\n✗ 채점 가능한 결과가 없습니다 (전부 파싱 실패).\n');
    process.exitCode = 1;
    return;
  }

  const { meanOverall, fieldMeans } = aggregate(scores);
  console.log('\n  ── 필드별 평균 ───────────────────');
  for (const [k, v] of Object.entries(fieldMeans)) {
    console.log(`     ${k.padEnd(18)} ${pct(v)}`);
  }
  console.log('  ─────────────────────────────────');
  console.log(`\n  전체 평균: ${pct(meanOverall)}  (${scores.length}건 채점, 파싱 실패 ${parseFailures.length}건)\n`);

  if (meanOverall < THRESHOLD) {
    console.log(`✗ 기준(${pct(THRESHOLD)}) 미달 — 프롬프트/스키마를 조정하고 다시 돌리세요.\n`);
    process.exitCode = 1;
  } else {
    console.log('✓ 기준 통과.\n');
  }
}

main().catch((e) => {
  console.error('eval 실행 오류:', e);
  process.exitCode = 1;
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type ParsedPosting } from '@joblog/types';

import { type FirecrawlService } from '../shared/firecrawl.service';
import { type LlmService } from './llm.service';
import { ParseService } from './parse.service';

const sample: ParsedPosting = {
  companyName: '네이버',
  position: '프론트엔드',
  location: null,
  employmentType: null,
  deadline: null,
  stages: [{ name: '서류', order: 0 }],
  confidence: 'high',
};

const LONG = 'a'.repeat(200); // 수집 성공으로 간주되는 길이(>50)

function makeService(opts: {
  firecrawlEnabled?: boolean;
  scraped?: string | null;
  llmEnabled?: boolean;
  parsed?: ParsedPosting | null;
  onScrape?: (url: string) => void;
}): ParseService {
  const firecrawl = {
    enabled: opts.firecrawlEnabled ?? true,
    scrape: (url: string) => {
      opts.onScrape?.(url);
      return Promise.resolve(opts.scraped ?? null);
    },
  } as unknown as FirecrawlService;
  const llm = {
    enabled: opts.llmEnabled ?? true,
    parse: () => Promise.resolve(opts.parsed ?? null),
  } as unknown as LlmService;
  return new ParseService(firecrawl, llm);
}

test('URL + Firecrawl 비활성 → 수집 건너뛰고 붙여넣기 폴백 (사용자가 겪던 증상)', async () => {
  let scrapeCalled = false;
  const svc = makeService({
    firecrawlEnabled: false,
    scraped: null,
    onScrape: () => (scrapeCalled = true),
  });
  const res = await svc.parse({ url: 'https://job/1' });
  assert.equal(res.needsManualInput, true);
  assert.match(res.notice ?? '', /설정되지 않았/);
  // 비활성이어도 scrape는 호출되고 null을 돌려줌(현재 설계) — 핵심은 폴백 분기
  assert.equal(scrapeCalled, true);
});

test('URL + 수집 성공 + LLM 성공 → 파싱 draft 반환', async () => {
  const svc = makeService({ scraped: LONG, parsed: sample });
  const res = await svc.parse({ url: 'https://job/1' });
  assert.equal(res.needsManualInput, false);
  assert.equal(res.draft.companyName, '네이버');
  assert.equal(res.draft.confidence, 'high');
});

test('URL + 수집 본문이 너무 짧음(≤50) → 폴백', async () => {
  const svc = makeService({ firecrawlEnabled: true, scraped: '짧은 본문' });
  const res = await svc.parse({ url: 'https://job/1' });
  assert.equal(res.needsManualInput, true);
  assert.match(res.notice ?? '', /가져오지 못/);
});

test('URL + 수집 성공 + LLM 실패(null) → 분석 실패 안내, 수동입력은 불필요', async () => {
  const svc = makeService({ scraped: LONG, llmEnabled: true, parsed: null });
  const res = await svc.parse({ url: 'https://job/1' });
  assert.equal(res.needsManualInput, false);
  assert.match(res.notice ?? '', /자동 분석/);
});

test('rawText가 있으면 Firecrawl을 호출하지 않는다', async () => {
  let scrapeCalled = false;
  const svc = makeService({
    parsed: sample,
    onScrape: () => (scrapeCalled = true),
  });
  const res = await svc.parse({ rawText: LONG });
  assert.equal(scrapeCalled, false);
  assert.equal(res.draft.companyName, '네이버');
});

test('url도 rawText도 없으면 입력 요청 폴백', async () => {
  const svc = makeService({});
  const res = await svc.parse({});
  assert.equal(res.needsManualInput, true);
  assert.match(res.notice ?? '', /입력해 주세요/);
});

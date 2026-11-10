import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { FirecrawlService } from './firecrawl.service';

const realFetch = globalThis.fetch;
const realKey = process.env.FIRECRAWL_API_KEY;

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.FIRECRAWL_API_KEY;
  else process.env.FIRECRAWL_API_KEY = realKey;
});

interface ScrapeBody {
  url: string;
  formats: string[];
  onlyMainContent: boolean;
}

test('키가 비어 있으면 enabled=false, scrape는 fetch 없이 null (사용자 .env 상태)', async () => {
  process.env.FIRECRAWL_API_KEY = '';
  let called = false;
  globalThis.fetch = () => {
    called = true;
    return Promise.resolve(new Response());
  };

  const fc = new FirecrawlService();
  assert.equal(fc.enabled, false);
  assert.equal(await fc.scrape('https://job/1'), null);
  assert.equal(called, false, '수집을 시도조차 하지 않아야 한다');
});

test('키가 있으면 올바른 요청을 보내고 data.markdown을 반환', async () => {
  process.env.FIRECRAWL_API_KEY = 'fc-test-key';
  let rawBody: string | null = null;
  let auth: string | null = null;
  globalThis.fetch = (_url: string | URL | Request, init?: RequestInit) => {
    rawBody = (init?.body as string | null) ?? null;
    auth = new Headers(init?.headers).get('authorization');
    return Promise.resolve(
      new Response(JSON.stringify({ data: { markdown: '# 채용 공고 본문' } }), {
        status: 200,
      }),
    );
  };

  const fc = new FirecrawlService();
  const md = await fc.scrape('https://job/1');

  assert.equal(md, '# 채용 공고 본문');
  // 파싱은 호출 뒤에 수행(클로저 할당 내로잉 회피)
  const body = JSON.parse(rawBody ?? '{}') as ScrapeBody;
  assert.equal(body.url, 'https://job/1');
  assert.ok(body.formats.includes('markdown'));
  assert.equal(body.onlyMainContent, true);
  assert.equal(auth, 'Bearer fc-test-key');
});

test('헤더 직무 제목이 본문에서 잘린 경우 metadata.ogTitle을 맨 앞 H1로 복원', async () => {
  process.env.FIRECRAWL_API_KEY = 'fc-test-key';
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          data: {
            markdown: '## 팀을 소개해요\n커뮤니티 빌더 집중 채용',
            metadata: { ogTitle: 'Product Designer - 커뮤니티' },
          },
        }),
        { status: 200 },
      ),
    );
  const fc = new FirecrawlService();
  const md = await fc.scrape('https://job/1');
  assert.ok(md?.startsWith('# Product Designer - 커뮤니티\n'), '직무명이 맨 앞 H1로');
  assert.ok(md?.includes('팀을 소개해요'), '본문도 유지');
});

test('타이틀이 이미 본문 앞부분에 있으면 중복 H1을 넣지 않는다', async () => {
  process.env.FIRECRAWL_API_KEY = 'fc-test-key';
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          data: {
            markdown: '# 백엔드 개발자\n주요업무',
            metadata: { title: '백엔드 개발자' },
          },
        }),
        { status: 200 },
      ),
    );
  const fc = new FirecrawlService();
  assert.equal(await fc.scrape('https://job/1'), '# 백엔드 개발자\n주요업무');
});

test('응답이 2xx가 아니면 null (수집 실패 → 폴백)', async () => {
  process.env.FIRECRAWL_API_KEY = 'fc-test-key';
  globalThis.fetch = () =>
    Promise.resolve(new Response('nope', { status: 500 }));
  const fc = new FirecrawlService();
  assert.equal(await fc.scrape('https://job/1'), null);
});

test('data.markdown이 없으면 null', async () => {
  process.env.FIRECRAWL_API_KEY = 'fc-test-key';
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify({ data: {} }), { status: 200 }),
    );
  const fc = new FirecrawlService();
  assert.equal(await fc.scrape('https://job/1'), null);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  extractCompanyCandidates,
  isCacheFresh,
  parseRatingSummary,
  searchUrl,
} from './jobplanet';

const DAY = 86_400_000;

test('후보 추출: 회사 링크 없으면 0개', () => {
  const md = '검색 결과가 없습니다. [채용공고](https://www.jobplanet.co.kr/job/1)';
  assert.equal(extractCompanyCandidates(md).length, 0);
});

test('후보 추출: 같은 회사의 여러 링크는 id로 dedup → 1개', () => {
  const md = `
[카카오](https://www.jobplanet.co.kr/companies/123/reviews)
[카카오 연봉](https://www.jobplanet.co.kr/companies/123/salaries)
[카카오 면접](/companies/123/interviews)
`;
  const c = extractCompanyCandidates(md);
  assert.equal(c.length, 1);
  assert.equal(c[0].id, '123');
  assert.equal(c[0].url, 'https://www.jobplanet.co.kr/companies/123');
});

test('후보 추출: 서로 다른 회사(동명 등) → 복수', () => {
  const md = `
[토스](https://www.jobplanet.co.kr/companies/111)
[토스뱅크](https://www.jobplanet.co.kr/companies/222)
`;
  assert.equal(extractCompanyCandidates(md).length, 2);
});

test('평점 파싱: 평점/총점/별점 키워드 뒤 X.X', () => {
  assert.equal(parseRatingSummary('기업 평점 3.5 / 5.0').rating, 3.5);
  assert.equal(parseRatingSummary('총점: 4').rating, 4);
  assert.equal(parseRatingSummary('★ 2.8 추천').rating, 2.8);
});

test('평점 파싱: 범위(0~5) 벗어나면 null', () => {
  assert.equal(parseRatingSummary('평점 9.9').rating, null);
  assert.equal(parseRatingSummary('조회수 1234').rating, null);
});

test('평점 파싱: 평점 단서 없으면 null', () => {
  assert.equal(parseRatingSummary('이 회사는 좋은 회사입니다.').rating, null);
});

test('요약 파싱: 한줄평 한 줄만, 없으면 null', () => {
  assert.equal(
    parseRatingSummary('한줄평: 워라밸이 좋아요\n다음 줄은 무시').summary,
    '워라밸이 좋아요',
  );
  assert.equal(parseRatingSummary('별도 요약 없음').summary, null);
});

test('캐시 신선도: TTL 이내 true, 경계/초과 false', () => {
  const now = 100 * DAY;
  assert.equal(isCacheFresh(now - 1 * DAY, now), true);
  assert.equal(isCacheFresh(now - 6.9 * DAY, now), true);
  assert.equal(isCacheFresh(now - 7 * DAY, now), false); // 경계 포함 만료
  assert.equal(isCacheFresh(now - 30 * DAY, now), false);
});

test('검색 딥링크: 쿼리 인코딩', () => {
  assert.ok(searchUrl('카카오 뱅크').includes('query=%EC%B9%B4%EC%B9%B4%EC%98%A4%20%EB%B1%85%ED%81%AC'));
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  extractCompanyCandidates,
  isCacheFresh,
  parseRatingSummary,
  pickCandidate,
  searchUrl,
} from './jobplanet';

const DAY = 86_400_000;

// 서비스의 normalize를 흉내낸 순수 함수 (테스트용)
const norm = (s: string): string =>
  s
    .replace(/\(주\)|\(유\)|주식회사|유한회사|㈜/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// 실제 잡플래닛 검색 결과 마크다운 구조를 축약한 픽스처
const SEARCH_MD = `
[![로고](logo1)\\
**(주)카카오** \\
IT/웹/통신 ∙서울](https://www.jobplanet.co.kr/companies/93880)

[![로고](logo2)\\
**(주)카카오** \\
∙제주](https://www.jobplanet.co.kr/companies/82715)

[![로고](logo3)\\
**(주)카카오페이** \\
∙판교](https://www.jobplanet.co.kr/companies/326339)
`;

test('후보 추출: **이름** → /companies/<id> 쌍, id로 dedup', () => {
  const c = extractCompanyCandidates(SEARCH_MD);
  assert.equal(c.length, 3);
  assert.deepEqual(
    c.map((x) => x.id),
    ['93880', '82715', '326339'],
  );
  assert.equal(c[0].name, '(주)카카오');
  assert.equal(c[0].url, 'https://www.jobplanet.co.kr/companies/93880');
});

test('후보 선택: 정규화 이름 정확 일치, 동명이면 첫 번째', () => {
  const c = extractCompanyCandidates(SEARCH_MD);
  const picked = pickCandidate(c, '카카오', norm);
  assert.equal(picked?.id, '93880'); // (주)카카오 → 카카오, 첫 번째
});

test('후보 선택: 부분일치(카카오페이)는 "카카오"로 선택 안 됨', () => {
  const only = extractCompanyCandidates(
    '[![l](x)\\\n**(주)카카오페이** ](https://www.jobplanet.co.kr/companies/326339)',
  );
  assert.equal(pickCandidate(only, '카카오', norm), null);
});

test('후보 선택: 일치 없으면 null (→ 딥링크)', () => {
  const c = extractCompanyCandidates(SEARCH_MD);
  assert.equal(pickCandidate(c, '네이버', norm), null);
});

test('평점 파싱: 잡플래닛 "전체 리뷰 통계 (N명) 3.8"', () => {
  const md = '## _전체 리뷰_ 통계 (1308명)  3.8  복지/급여  3.5  워라밸  4.2';
  assert.equal(parseRatingSummary(md).rating, 3.8);
});

test('평점 파싱: 총점/★ 폴백, 범위 밖/없음은 null', () => {
  assert.equal(parseRatingSummary('총점 4.1').rating, 4.1);
  assert.equal(parseRatingSummary('★ 2.7').rating, 2.7);
  assert.equal(parseRatingSummary('평점 9.9').rating, null);
  assert.equal(parseRatingSummary('평점 정보 없음').rating, null);
});

test('캐시 신선도: TTL 이내 true, 경계/초과 false', () => {
  const now = 100 * DAY;
  assert.equal(isCacheFresh(now - 1 * DAY, now), true);
  assert.equal(isCacheFresh(now - 7 * DAY, now), false);
});

test('검색 딥링크: query 인코딩 + type=companies', () => {
  const u = searchUrl('카카오');
  assert.ok(u.includes('query=%EC%B9%B4%EC%B9%B4%EC%98%A4'));
  assert.ok(u.includes('type=companies'));
});

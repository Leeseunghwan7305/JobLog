import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildLinks,
  companyMonths,
  computeTrends,
  estimateAnnualSalaryManwon,
  estimateTenureMonths,
  groupCompanies,
  parseBassItems,
  parseDetail,
  parsePeriod,
  pickWorkplace,
  recentYms,
  toSearchResults,
} from './nps';

const norm = (s: string): string =>
  s
    .replace(/\(주\)|\(유\)|주식회사|유한회사|㈜/g, '')
    .replace(/\s+/g, ' ')
    .trim();

test('추정연봉: (고지금액/가입자수)/0.09*12 를 만원으로 반올림', () => {
  // 1인당 월고지 203,400원 → 월소득 2,260,000 → 연 27,120,000 → 2712만원
  assert.equal(estimateAnnualSalaryManwon(203_400, 1), 2712);
});

test('추정연봉: 가입자수 0 또는 금액 결측이면 null', () => {
  assert.equal(estimateAnnualSalaryManwon(100000, 0), null);
  assert.equal(estimateAnnualSalaryManwon(null, 10), null);
});

test('parseBassItems: response.body.items.item 배열을 NpsWorkplace[]로', () => {
  const json = {
    response: {
      body: {
        items: {
          item: [
            {
              seq: '20240001',
              wkplNm: '(주)카카오',
              bzowrRgstNo: '120816****',
              wkplRoadNmDtlAddr: '제주 제주시',
              wkplIntpCd: 'IT',
              dataCrtYm: '202506',
            },
          ],
        },
      },
    },
  };
  const items = parseBassItems(json);
  assert.equal(items.length, 1);
  assert.equal(items[0].seq, '20240001');
  assert.equal(items[0].name, '(주)카카오');
});

test('parseBassItems: 단일 객체(item이 배열 아님)도 1건으로', () => {
  const json = {
    response: { body: { items: { item: { seq: '1', wkplNm: 'A' } } } },
  };
  const items = parseBassItems(json);
  assert.equal(items.length, 1);
  assert.equal(items[0].seq, '1');
  assert.equal(items[0].name, 'A');
});

test('parseBassItems: 빈/비정상 응답은 빈 배열', () => {
  assert.deepEqual(parseBassItems({}), []);
  assert.deepEqual(parseBassItems(null), []);
});

test('pickWorkplace: 정규화 완전일치가 정확히 1건이면 그것', () => {
  const items = [
    { seq: '1', name: '(주)카카오', bizno: null, address: null, industry: null, dataYm: null },
    { seq: '2', name: '카카오모빌리티', bizno: null, address: null, industry: null, dataYm: null },
  ];
  const picked = pickWorkplace(items, '카카오', norm);
  assert.equal(picked?.seq, '1');
});

test('pickWorkplace: 완전일치가 복수면 null(보수적)', () => {
  const items = [
    { seq: '1', name: '카카오', bizno: null, address: null, industry: null, dataYm: null },
    { seq: '2', name: '(주)카카오', bizno: null, address: null, industry: null, dataYm: null },
  ];
  assert.equal(pickWorkplace(items, '카카오', norm), null);
});

test('pickWorkplace: 일치 0건이면 null', () => {
  const items = [
    { seq: '2', name: '네이버', bizno: null, address: null, industry: null, dataYm: null },
  ];
  assert.equal(pickWorkplace(items, '카카오', norm), null);
});

test('parseDetail: 가입자수·고지금액·업종명 매핑', () => {
  const json = {
    response: {
      body: {
        items: {
          item: {
            jnngpCnt: '551',
            crrmmNtcAmt: '337785000',
            vldtVlKrnNm: '일반 창고업',
            dataCrtYm: '202609',
            adptDt: '20170401',
          },
        },
      },
    },
  };
  const d = parseDetail(json);
  assert.equal(d?.memberCount, 551);
  assert.equal(d?.crrmmNtcAmt, 337785000);
  assert.equal(d?.industry, '일반 창고업');
  assert.equal(d?.dataYm, '202609');
  assert.equal(d?.joinedYear, 2017);
});

test('estimateTenureMonths: 월평균 퇴사율의 역수(개월)', () => {
  // 10명 중 매월 1명 퇴사 → 월퇴사율 0.1 → 근속 ~10개월
  const months = [
    { ym: '202505', memberCount: 10, joined: 0, left: 1, estimatedAnnualSalaryManwon: null },
    { ym: '202506', memberCount: 10, joined: 0, left: 1, estimatedAnnualSalaryManwon: null },
  ];
  assert.equal(estimateTenureMonths(months), 10);
});

test('estimateTenureMonths: 퇴사 0이면 null(추정 불가)', () => {
  const months = [
    { ym: '202506', memberCount: 9, joined: 0, left: 0, estimatedAnnualSalaryManwon: null },
  ];
  assert.equal(estimateTenureMonths(months), null);
});

test('parsePeriod: 입(nwAcqzrCnt)·퇴(lssJnngpCnt) 매핑', () => {
  const json = {
    response: { body: { items: { item: [{ lssJnngpCnt: 2, nwAcqzrCnt: 0 }] } } },
  };
  const p = parsePeriod(json);
  assert.equal(p.joined, 0);
  assert.equal(p.left, 2);
});

test('buildLinks: 잡플래닛·잡서치·크레딧잡·공고검색 4개', () => {
  const links = buildLinks('카카오');
  assert.equal(links.length, 4);
  for (const l of links) assert.match(l.url, /^https:\/\//);
  assert.ok(links.some((l) => l.url.includes('jobplanet')));
});

test('computeTrends: ym 오름차순 정렬 + 최신월 회전율(%)', () => {
  const r = computeTrends([
    { ym: '202506', memberCount: 12, crrmmNtcAmt: null, joined: 2, left: 1 },
    { ym: '202505', memberCount: 10, crrmmNtcAmt: null, joined: 1, left: 0 },
  ]);
  assert.deepEqual(
    r.trend.map((t) => t.ym),
    ['202505', '202506'],
  );
  // 최신월(202506): (2+1)/12*100 = 25.0
  assert.equal(r.turnoverRatePct, 25);
});

test('computeTrends: 빈 입력 → trend [], 회전율 null', () => {
  const r = computeTrends([]);
  assert.deepEqual(r.trend, []);
  assert.equal(r.turnoverRatePct, null);
});

test('computeTrends: 직원수 0이면 회전율 null', () => {
  const r = computeTrends([
    { ym: '202506', memberCount: 0, crrmmNtcAmt: null, joined: 0, left: 0 },
  ]);
  assert.equal(r.turnoverRatePct, null);
});

test('recentYms: 연말 넘어가며 내림차순 n개월', () => {
  assert.deepEqual(recentYms('202502', 4), ['202502', '202501', '202412', '202411']);
});

test('recentYms: 파싱 불가하면 입력 그대로 1개', () => {
  assert.deepEqual(recentYms('bad', 6), ['bad']);
});

test('groupCompanies: 회사×월 중복을 회사 단위로, 대표 seq=최신월', () => {
  const items = [
    { seq: 'A2', name: '카카오', bizno: '120', address: '제주', industry: 'IT', dataYm: '202508' },
    { seq: 'A1', name: '카카오', bizno: '120', address: '제주', industry: 'IT', dataYm: '202507' },
    { seq: 'B1', name: '카카오', bizno: '999', address: '서울', industry: 'IT', dataYm: '202508' },
  ];
  const g = groupCompanies(items);
  assert.equal(g.length, 2);
  assert.equal(g.find((c) => c.region === '제주')?.seq, 'A2');
});

test('companyMonths: seq가 속한 회사의 월들 최신 내림차순', () => {
  const items = [
    { seq: 'A2', name: '카카오', bizno: '120', address: '제주', industry: null, dataYm: '202508' },
    { seq: 'A1', name: '카카오', bizno: '120', address: '제주', industry: null, dataYm: '202507' },
    { seq: 'B1', name: '카카오', bizno: '999', address: '서울', industry: null, dataYm: '202508' },
  ];
  assert.deepEqual(
    companyMonths(items, 'A1').map((w) => w.seq),
    ['A2', 'A1'],
  );
});

test('toSearchResults: seq 없는 항목 제외하고 매핑', () => {
  const items = [
    { seq: '1', name: 'A', bizno: null, address: '서울', industry: 'IT', dataYm: null },
    { seq: '', name: 'B', bizno: null, address: null, industry: null, dataYm: null },
  ];
  const r = toSearchResults(items);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], { seq: '1', name: 'A', region: '서울', industry: 'IT' });
});

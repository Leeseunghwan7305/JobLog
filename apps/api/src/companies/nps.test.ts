import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildLinks,
  estimateAnnualSalaryManwon,
  parseBassItems,
  parseDetail,
  pickWorkplace,
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
  assert.equal(parseBassItems(json).length, 1);
});

test('parseBassItems: 빈/비정상 응답은 빈 배열', () => {
  assert.deepEqual(parseBassItems({}), []);
  assert.deepEqual(parseBassItems(null), []);
});

test('pickWorkplace: 정규화 완전일치가 정확히 1건이면 그것', () => {
  const items = [
    {
      seq: '1',
      name: '(주)카카오',
      bizno: null,
      address: null,
      industry: null,
      dataYm: null,
    },
    {
      seq: '2',
      name: '카카오모빌리티',
      bizno: null,
      address: null,
      industry: null,
      dataYm: null,
    },
  ];
  const picked = pickWorkplace(items, '카카오', norm);
  assert.equal(picked?.seq, '1');
});

test('pickWorkplace: 완전일치가 복수면 null(보수적)', () => {
  const items = [
    {
      seq: '1',
      name: '카카오',
      bizno: null,
      address: null,
      industry: null,
      dataYm: null,
    },
    {
      seq: '2',
      name: '(주)카카오',
      bizno: null,
      address: null,
      industry: null,
      dataYm: null,
    },
  ];
  assert.equal(pickWorkplace(items, '카카오', norm), null);
});

test('pickWorkplace: 일치 0건이면 null', () => {
  const items = [
    {
      seq: '2',
      name: '네이버',
      bizno: null,
      address: null,
      industry: null,
      dataYm: null,
    },
  ];
  assert.equal(pickWorkplace(items, '카카오', norm), null);
});

test('parseDetail: 가입자수/고지금액/입퇴사 매핑', () => {
  const json = {
    response: {
      body: {
        items: {
          item: {
            jnngpCnt: '7',
            crrmmNtcAmt: '1423800',
            nwAcqzrCnt: '1',
            lssJdgmntCnt: '2',
            wkplIntpCd: '영화·방송',
          },
        },
      },
    },
  };
  const d = parseDetail(json);
  assert.equal(d?.memberCount, 7);
  assert.equal(d?.crrmmNtcAmt, 1423800);
  assert.equal(d?.newThisMonth, 1);
  assert.equal(d?.lostThisMonth, 2);
});

test('buildLinks: 잡플래닛·잡서치·크레딧잡·공고검색 4개', () => {
  const links = buildLinks('카카오');
  assert.equal(links.length, 4);
  for (const l of links) assert.match(l.url, /^https:\/\//);
  assert.ok(links.some((l) => /jobplanet/.test(l.url)));
});

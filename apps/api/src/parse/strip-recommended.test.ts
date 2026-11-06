import assert from 'node:assert/strict';
import { test } from 'node:test';

import { stripNoise, stripRecommended } from './types';

test('stripNoise: 이미지·링크 URL·장식선 제거, 라벨·본문은 보존', () => {
  const md = [
    '# 프론트엔드 개발자',
    '![로고](https://img.example.com/logo.png)',
    '우리는 [리액트](https://react.dev)로 개발합니다.',
    '지원: https://apply.example.com/123',
    '* * *',
    '주요업무: 서비스 개발',
  ].join('\n');
  const out = stripNoise(md);
  assert.ok(out.includes('프론트엔드 개발자'));
  assert.ok(out.includes('리액트로 개발합니다'), '링크는 라벨만 남아야');
  assert.ok(out.includes('주요업무: 서비스 개발'));
  assert.ok(!out.includes('http'), 'URL 토큰은 제거돼야');
  assert.ok(!out.includes('!['), '이미지 마크다운 제거');
  assert.ok(!/^\s*\*\s*\*\s*\*\s*$/m.test(out), '수평선 장식 제거');
});

test('stripNoise: 과다 공백을 2줄로 축약', () => {
  assert.equal(stripNoise('A\n\n\n\n\nB'), 'A\n\nB');
});

test('stripNoise: title에 )가 있는 링크도 라벨만 깔끔히(사람인 (주)X 중복 방지)', () => {
  const md = '[(주)디지털포토](https://www.saramin.co.kr/view?csn=abc "(주)디지털포토") 합격 시 50만원';
  const out = stripNoise(md);
  assert.equal(out, '(주)디지털포토 합격 시 50만원');
  assert.ok(!out.includes('디지털포토디지털포토'), '이름이 중복되면 안 됨');
});

test('stripRecommended: 푸터/저작권/지도도 잘라낸다', () => {
  const body = '회사 소개와 주요업무 '.repeat(40); // 400자 보호 구간 넘김
  const text = body + '본 채용정보는 원티드랩의 동의없이 무단전재 금지. # 지도 데이터';
  const out = stripRecommended(text);
  assert.ok(!out.includes('무단전재'));
  assert.ok(!out.includes('지도 데이터'));
});

test('추천/광고 섹션(마커 이후)을 잘라낸다', () => {
  const body = 'A'.repeat(500) + ' 진짜 공고 본문 ';
  const text = body + 'HOT100 (주)농심 2026 신입사원 채용 ...';
  const out = stripRecommended(text);
  assert.ok(out.includes('진짜 공고 본문'));
  assert.ok(!out.includes('농심'), '추천 섹션의 다른 회사가 제거돼야');
  assert.ok(!out.includes('HOT100'));
});

test('가장 먼저 나오는 마커에서 자른다', () => {
  const pre = 'X'.repeat(600);
  const out = stripRecommended(pre + '함께 본 공고 ... 추천 공고 ...');
  assert.equal(out, pre);
});

test('마커가 400자 이전이면 자르지 않는다 (실제 공고 보호)', () => {
  const text = '추천 공고 ' + 'B'.repeat(50);
  assert.equal(stripRecommended(text), text.trim());
});

test('마커가 없으면 원문을 그대로 둔다', () => {
  const text = 'C'.repeat(1000);
  assert.equal(stripRecommended(text), text);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildWantedText,
  extractJson,
  matchWantedId,
  wantedApiUrl,
} from './wanted.adapter';

test('matchWantedId: wd/{id} 추출, 아니면 null', () => {
  assert.equal(matchWantedId('https://www.wanted.co.kr/wd/396517'), '396517');
  assert.equal(matchWantedId('https://www.wanted.co.kr/wd/396517?ref=x'), '396517');
  assert.equal(matchWantedId('https://wanted.co.kr/wd/12'), '12');
  assert.equal(matchWantedId('https://www.saramin.co.kr/zf_user/jobs/123'), null);
  assert.equal(matchWantedId('https://www.wanted.co.kr/company/22087'), null);
});

test('wantedApiUrl: chaos details 엔드포인트', () => {
  assert.equal(
    wantedApiUrl('396517'),
    'https://www.wanted.co.kr/api/chaos/jobs/v4/396517/details',
  );
});

test('extractJson: ```json 래핑 안에서 객체 파싱', () => {
  const md = '```json\n{"a":1,"b":{"c":2}}\n```';
  assert.deepEqual(extractJson(md), { a: 1, b: { c: 2 } });
  assert.equal(extractJson('no json here'), null);
  assert.equal(extractJson('{broken'), null);
});

const SAMPLE = {
  data: {
    job: {
      due_time: '2026-12-31T00:00:00',
      employment_type: '정규직',
      company: { name: '어스얼라이언스' },
      address: { full_location: '서울 마포구 양화로 78-22' },
      detail: {
        position: '플랫폼 파트 - Frontend Developer (3~5년차)',
        intro: '사용자 경험을 최우선으로…',
        main_tasks: '웹 서비스 5개 운영',
        requirements: 'React 깊은 이해',
        preferred_points: 'Flutter 경험',
        hire_rounds:
          '서류평가 ＞온라인 커피챗 ＞ 사전과제 ＞ 1차 실무 면접 ＞2차 임원 면접 ＞ 처우협의 ＞ 최종합격 및 입사',
        benefits: '합격보상 50만원',
      },
    },
  },
};

test('buildWantedText: 핵심 필드 + 채용 절차(hire_rounds) 포함', () => {
  const text = buildWantedText(SAMPLE);
  assert.ok(text);
  assert.match(text, /회사명: 어스얼라이언스/);
  assert.match(text, /직무: 플랫폼 파트 - Frontend Developer/);
  assert.match(text, /근무지: 서울 마포구 양화로 78-22/);
  assert.match(text, /마감일: 2026-12-31/);
  assert.match(text, /\[채용 절차\]/);
  assert.match(text, /온라인 커피챗.*처우협의.*최종합격 및 입사/);
});

test('buildWantedText: 회사·직무 둘 다 없으면 null(신뢰 못 할 응답)', () => {
  assert.equal(buildWantedText({ data: { job: { detail: {} } } }), null);
  assert.equal(buildWantedText({}), null);
  assert.equal(buildWantedText(null), null);
});

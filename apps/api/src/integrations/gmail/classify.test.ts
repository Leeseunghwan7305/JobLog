import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classify } from './gmail.service';

test('불합격 메일은 failed (합격 글자가 포함돼도 fail 우선)', () => {
  assert.equal(classify('안타깝게도 이번 채용에서 불합격하셨습니다'), 'failed');
  assert.equal(classify('서류 전형 결과 안내: 아쉽게도 탈락'), 'failed');
  assert.equal(classify('죄송하게도 함께하지 못하게 되었습니다'), 'failed');
});

test('합격/다음 전형 메일은 passed', () => {
  assert.equal(classify('축하드립니다! 서류 전형에 합격하셨습니다'), 'passed');
  assert.equal(classify('최종 합격을 축하드립니다'), 'passed');
  assert.equal(classify('다음 전형(1차 면접) 일정 안내'), 'passed');
  assert.equal(classify('면접 제안 드립니다'), 'passed');
});

test('신호 없는 메일은 null', () => {
  assert.equal(classify('지원해주셔서 감사합니다. 접수되었습니다'), null);
  assert.equal(classify('뉴스레터: 이번 주 채용 소식'), null);
});

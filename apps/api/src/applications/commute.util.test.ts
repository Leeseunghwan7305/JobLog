import assert from 'node:assert/strict';
import { test } from 'node:test';

import { naverDirectionsUrl } from './commute.util';

const home = { lat: 37.4979, lng: 127.0276, name: '집' };
const company = { lat: 37.5665, lng: 126.978, name: '네이버' };

test('네이버 길찾기 URL: lng,lat 순서 + 대중교통(transit) 기본', () => {
  const url = naverDirectionsUrl(home, company);
  assert.ok(url.startsWith('https://map.naver.com/p/directions/'));
  // 출발: lng,lat 순서 (네이버 규격)
  assert.match(url, /\/127\.0276,37\.4979,/);
  // 도착: lng,lat 순서
  assert.match(url, /\/126\.978,37\.5665,/);
  // 모드
  assert.ok(url.endsWith('/-/transit'));
});

test('이름은 URL 인코딩한다 (한글·공백)', () => {
  const url = naverDirectionsUrl(
    { lat: 1, lng: 2, name: '우리 집' },
    { lat: 3, lng: 4, name: '카카오 판교' },
  );
  assert.ok(url.includes(encodeURIComponent('우리 집')));
  assert.ok(url.includes(encodeURIComponent('카카오 판교')));
  // 인코딩 안 된 공백이 경로에 그대로 들어가면 안 됨
  assert.ok(!url.includes('우리 집'));
});

test('모드를 바꿀 수 있다 (자동차)', () => {
  const url = naverDirectionsUrl(home, company, 'car');
  assert.ok(url.endsWith('/-/car'));
});

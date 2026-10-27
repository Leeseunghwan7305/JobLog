import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseKakaoGeocode, parseNominatim } from './geo.service';

test('Kakao 주소 응답 첫 문서를 좌표로 파싱 (x=lng, y=lat)', () => {
  const json = {
    documents: [
      { address_name: '서울 강남구 테헤란로 1', x: '127.0276', y: '37.4979' },
    ],
  };
  assert.deepEqual(parseKakaoGeocode(json), {
    lat: 37.4979,
    lng: 127.0276,
    address: '서울 강남구 테헤란로 1',
  });
});

test('문서가 없으면 null', () => {
  assert.equal(parseKakaoGeocode({ documents: [] }), null);
  assert.equal(parseKakaoGeocode({}), null);
  assert.equal(parseKakaoGeocode(null), null);
});

test('좌표가 숫자가 아니면 null (깨진 응답 방어)', () => {
  assert.equal(
    parseKakaoGeocode({ documents: [{ x: '', y: 'abc' }] }),
    null,
  );
});

test('주소명이 없으면 place_name으로 폴백', () => {
  const r = parseKakaoGeocode({
    documents: [{ place_name: '네이버', x: '126.978', y: '37.5665' }],
  });
  assert.equal(r?.address, '네이버');
});

test('Nominatim 첫 결과를 좌표로 파싱 (lat/lon 문자열)', () => {
  const json = [
    { lat: '37.5000191', lon: '127.0365483', display_name: '강남파이낸스센터, …' },
  ];
  assert.deepEqual(parseNominatim(json), {
    lat: 37.5000191,
    lng: 127.0365483,
    address: '강남파이낸스센터, …',
  });
});

test('Nominatim 빈 배열·비배열은 null', () => {
  assert.equal(parseNominatim([]), null);
  assert.equal(parseNominatim(null), null);
  assert.equal(parseNominatim({}), null);
});

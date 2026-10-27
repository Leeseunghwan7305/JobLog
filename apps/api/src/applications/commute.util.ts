export interface GeoPoint {
  lat: number;
  lng: number;
  name: string;
}

/**
 * 네이버 지도 길찾기 딥링크를 만든다. (M4 통근 길찾기, 순수 함수)
 * 규격: /p/directions/{lng},{lat},{name},,/{lng},{lat},{name},,/-/{mode}
 * - 좌표는 네이버 규격상 경도(lng),위도(lat) 순서.
 * - 이름은 URL 인코딩(한글·공백 대응).
 * - mode: transit(대중교통, 기본) | car | walk | bicycle.
 */
export function naverDirectionsUrl(
  start: GeoPoint,
  goal: GeoPoint,
  mode: 'transit' | 'car' | 'walk' | 'bicycle' = 'transit',
): string {
  const seg = (p: GeoPoint) =>
    `${p.lng},${p.lat},${encodeURIComponent(p.name)},,`;
  return `https://map.naver.com/p/directions/${seg(start)}/${seg(goal)}/-/${mode}`;
}

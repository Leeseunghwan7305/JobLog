import { Injectable, Logger } from '@nestjs/common';

export interface GeoResult {
  lat: number;
  lng: number;
  /** 지오코딩으로 정규화된 주소/장소명 (확인용). */
  address: string;
}

interface KakaoDoc {
  x?: string; // 경도(lng)
  y?: string; // 위도(lat)
  address_name?: string;
  place_name?: string;
}

/**
 * Kakao Local 응답의 첫 문서를 좌표로 파싱한다. (순수 함수)
 * x=경도(lng), y=위도(lat). 문서가 없거나 좌표가 숫자가 아니면 null.
 */
export function parseKakaoGeocode(json: unknown): GeoResult | null {
  const docs = (json as { documents?: KakaoDoc[] } | null)?.documents;
  const doc = docs?.[0];
  if (!doc) return null;
  const lat = Number(doc.y);
  const lng = Number(doc.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, address: doc.address_name ?? doc.place_name ?? '' };
}

interface NominatimDoc {
  lat?: string;
  lon?: string; // 경도
  display_name?: string;
  name?: string;
}

/**
 * Nominatim(OSM) 응답의 첫 결과를 좌표로 파싱한다. (순수 함수)
 * 결과가 없거나 좌표가 숫자가 아니면 null.
 */
export function parseNominatim(json: unknown): GeoResult | null {
  const doc = Array.isArray(json) ? (json[0] as NominatimDoc | undefined) : null;
  if (!doc) return null;
  const lat = Number(doc.lat);
  const lng = Number(doc.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, address: doc.display_name ?? doc.name ?? '' };
}

/**
 * 지오코딩 후보 쿼리(점점 거칠게). (순수 함수)
 * Nominatim은 한국 도로명 주소 끝의 건물명("V & S 빌딩")을 못 찾는 경우가 많아,
 * 전체 → 건물명 제거(마지막 번지 숫자까지) → 도로 레벨 → 시·구 레벨 순으로 시도한다.
 * 첫 매칭에서 멈추므로 보통 1~2개만 실제 호출된다.
 */
export function geoCandidates(query: string): string[] {
  const q = query.trim();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter((t) => t.length > 0);
  const cands = [q];
  // 건물명 등 꼬리 제거: 숫자(번지/건물번호)를 포함한 마지막 토큰까지만 남김
  let lastNumIdx = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (/\d/.test(tokens[i])) {
      lastNumIdx = i;
      break;
    }
  }
  if (lastNumIdx >= 0 && lastNumIdx < tokens.length - 1) {
    cands.push(tokens.slice(0, lastNumIdx + 1).join(' '));
  }
  if (tokens.length > 3) cands.push(tokens.slice(0, 3).join(' ')); // 도로 레벨
  if (tokens.length > 2) cands.push(tokens.slice(0, 2).join(' ')); // 시·구 레벨
  return [...new Set(cands)];
}

/**
 * 주소/지명 → 좌표.
 * Kakao Local API(기존 REST 키, 콘솔에서 카카오맵 활성화 시) 우선,
 * 안 되면 키 불필요한 Nominatim(OSM)으로 폴백. 둘 다 실패하면 건물명을 떼는 등
 * 점점 거친 후보로 재시도한다. 전부 실패하면 null(→ 길찾기 숨김). 비밀키는 백엔드 전용.
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  private get kakaoEnabled(): boolean {
    return !!process.env.KAKAO_REST_API_KEY;
  }

  async geocode(query: string): Promise<GeoResult | null> {
    for (const cand of geoCandidates(query)) {
      if (this.kakaoEnabled) {
        const k =
          (await this.kakao('address', cand)) ??
          (await this.kakao('keyword', cand));
        if (k) return k;
      }
      const n = await this.nominatim(cand);
      if (n) return n;
    }
    return null;
  }

  private async kakao(
    kind: 'address' | 'keyword',
    q: string,
  ): Promise<GeoResult | null> {
    try {
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/${kind}.json?query=${encodeURIComponent(q)}&size=1`,
        { headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` } },
      );
      if (!res.ok) {
        // 403 = 카카오 앱에 '카카오맵(Local)' 미활성. Nominatim 폴백으로 이어짐.
        this.logger.warn(`Kakao geocode ${kind} ${res.status} for "${q}"`);
        return null;
      }
      return parseKakaoGeocode(await res.json());
    } catch (e) {
      this.logger.warn(`Kakao geocode failed: ${String(e)}`);
      return null;
    }
  }

  private async nominatim(q: string): Promise<GeoResult | null> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=kr`,
        // Nominatim ToS: User-Agent 필수.
        { headers: { 'User-Agent': 'JobLog/1.0 (job tracker)' } },
      );
      if (!res.ok) {
        this.logger.warn(`Nominatim ${res.status} for "${q}"`);
        return null;
      }
      return parseNominatim(await res.json());
    } catch (e) {
      this.logger.warn(`Nominatim failed: ${String(e)}`);
      return null;
    }
  }
}

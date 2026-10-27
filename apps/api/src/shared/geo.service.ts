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
 * 주소/지명 → 좌표.
 * Kakao Local API(기존 REST 키, 콘솔에서 카카오맵 활성화 시) 우선,
 * 안 되면 키 불필요한 Nominatim(OSM)으로 폴백. 전부 실패하면 null(→ 길찾기 숨김).
 * 비밀키는 백엔드 전용.
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  private get kakaoEnabled(): boolean {
    return !!process.env.KAKAO_REST_API_KEY;
  }

  async geocode(query: string): Promise<GeoResult | null> {
    const q = query.trim();
    if (!q) return null;
    if (this.kakaoEnabled) {
      const k =
        (await this.kakao('address', q)) ?? (await this.kakao('keyword', q));
      if (k) return k;
    }
    return this.nominatim(q);
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

import { Injectable } from '@nestjs/common';

export interface CompanyReviewDto {
  companyName: string;
  rating: number | null;
  summary: string | null;
  sourceUrl: string;
}

@Injectable()
export class CompaniesService {
  /** 회사명 정규화: 법인 접미사·여분 공백 제거 (spec 6.1) */
  normalize(name: string): string {
    return name
      .replace(/\(주\)|\(유\)|주식회사|유한회사|㈜|㈜/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 기업 후기 조회 (M4, best-effort).
   * MVP: 정규화된 회사명으로 잡플래닛 검색 딥링크를 제공한다.
   * 공개 평점·요약 스크래핑과 캐시는 M4에서 확장 (전체 후기 본문은 수집하지 않음).
   */
  async getReviews(nameRaw: string): Promise<CompanyReviewDto> {
    const name = this.normalize(nameRaw);
    const sourceUrl = `https://www.jobplanet.co.kr/search?query=${encodeURIComponent(name)}`;
    return { companyName: name, rating: null, summary: null, sourceUrl };
  }
}

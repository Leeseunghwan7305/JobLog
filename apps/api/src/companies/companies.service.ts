import type { CompanyReviewDto } from '@joblog/types';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { FirecrawlService } from '../shared/firecrawl.service';
import {
  extractCompanyCandidates,
  isCacheFresh,
  parseRatingSummary,
  pickCandidate,
  SCRAPE_WAIT_MS,
  searchUrl,
} from './jobplanet';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private prisma: PrismaService,
    private firecrawl: FirecrawlService,
  ) {}

  /** 회사명 정규화: 법인 접미사·여분 공백 제거 (spec 6.1) */
  normalize(name: string): string {
    return (name ?? '')
      .replace(/\(주\)|\(유\)|주식회사|유한회사|㈜/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 기업 후기 조회 (M4, best-effort).
   * 정규화 → 캐시(7일) → 잡플래닛 검색(waitFor) → 이름 일치 후보 선택 → 회사 페이지 평점 파싱.
   * 이름 일치 후보가 없거나 수집/파싱 실패면 저장하지 않고 검색 딥링크만 반환 (spec 6.1).
   */
  async getReviews(nameRaw: string): Promise<CompanyReviewDto> {
    const name = this.normalize(nameRaw);
    const deepLink = searchUrl(name);
    const fallback: CompanyReviewDto = {
      companyName: name,
      rating: null,
      summary: null,
      sourceUrl: deepLink,
    };
    if (!name) return fallback;

    // 1) 캐시 (정규화 키 기준)
    const cached = await this.prisma.companyReview.findUnique({
      where: { companyName: name },
    });
    if (cached && isCacheFresh(cached.fetchedAt.getTime(), Date.now())) {
      return {
        companyName: name,
        rating: cached.rating,
        summary: cached.summary,
        sourceUrl: cached.sourceUrl ?? deepLink,
      };
    }

    // 2) 수집 비활성이면 딥링크만
    if (!this.firecrawl.enabled) return fallback;

    // 3) best-effort 수집
    try {
      const searchMd = await this.firecrawl.scrape(deepLink, {
        waitFor: SCRAPE_WAIT_MS,
      });
      const candidates = searchMd ? extractCompanyCandidates(searchMd) : [];
      const match = pickCandidate(candidates, name, (s) => this.normalize(s));
      // 이름 일치 후보 없음 → 자신 있게 틀린 정보 대신 딥링크
      if (!match) return fallback;

      const pageMd = await this.firecrawl.scrape(match.url, {
        waitFor: SCRAPE_WAIT_MS,
      });
      const { rating, summary } = pageMd
        ? parseRatingSummary(pageMd)
        : { rating: null, summary: null };

      const saved = await this.prisma.companyReview.upsert({
        where: { companyName: name },
        update: { rating, summary, sourceUrl: match.url, fetchedAt: new Date() },
        create: { companyName: name, rating, summary, sourceUrl: match.url },
      });
      return {
        companyName: name,
        rating: saved.rating,
        summary: saved.summary,
        sourceUrl: saved.sourceUrl ?? deepLink,
      };
    } catch (e) {
      this.logger.warn(`jobplanet 수집 실패 (${name}): ${String(e)}`);
      return fallback;
    }
  }
}
